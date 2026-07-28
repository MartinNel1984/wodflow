-- ============================================================
-- Wodflow — migration 026: multi-tenancy (organizations)
--
-- Wodflow is about to onboard a second box. Until now every table
-- hung off event_id with no notion of which organizer/box owned it —
-- is_organizer() just checked profiles.role globally, so any
-- organizer login could read/write every box's events, athletes,
-- and scores. This migration adds an organizations table, threads
-- organization_id through profiles + events (every dependent table
-- inherits scoping through event_id via RLS joins, so it doesn't
-- need its own organization_id column), and rewrites every RLS
-- policy that used is_organizer() to also check org membership.
--
-- Design doc: docs/plans/2026-07-28-multi-tenancy-design.md
--
-- Run this whole file in the Supabase SQL Editor in one go — it's
-- schema + backfill + RLS together, same convention as the rest of
-- this migration series. Safe to re-run (backfill steps are
-- idempotent via WHERE ... IS NULL guards).
-- ============================================================

-- ------------------------------------------------------------
-- 1. organizations
-- ------------------------------------------------------------
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  status     text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- ------------------------------------------------------------
-- 2. profiles — add organization_id, extend role check for
--    platform_admin (a 4th role, alongside migration-006's
--    head_judge). null organization_id for athlete/platform_admin.
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists organization_id uuid references public.organizations(id);

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('organizer', 'judge', 'head_judge', 'athlete', 'platform_admin'));

-- ------------------------------------------------------------
-- 3. events — add organization_id (the tenancy root). Nullable
--    until backfilled below, then locked to not null.
-- ------------------------------------------------------------
alter table public.events
  add column if not exists organization_id uuid references public.organizations(id);

-- ------------------------------------------------------------
-- 4. brand_kits / series — reusable organizer assets that aren't
--    tied to a single event_id, so they need their own
--    organization_id rather than inheriting through a join.
-- ------------------------------------------------------------
alter table public.brand_kits
  add column if not exists organization_id uuid references public.organizations(id);

alter table public.series
  add column if not exists organization_id uuid references public.organizations(id);

-- ------------------------------------------------------------
-- 5. org_invites — token-link invite flow, mirrors team_invites'
--    proven pattern (migration-011). Accept flow is a new app route,
--    not built here.
-- ------------------------------------------------------------
create table if not exists public.org_invites (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  email            text not null,
  role             text not null check (role in ('organizer', 'judge', 'head_judge')),
  token            uuid not null default gen_random_uuid(),
  status           text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  invited_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  accepted_at      timestamptz
);

alter table public.org_invites enable row level security;

-- ------------------------------------------------------------
-- 6. Backfill — everything that exists today belongs to ATG.
--    Idempotent: only touches rows still missing an org.
-- ------------------------------------------------------------
insert into public.organizations (name, slug, status)
select 'Against The Grain Fitness', 'atg', 'active'
where not exists (select 1 from public.organizations where slug = 'atg');

update public.profiles
set organization_id = (select id from public.organizations where slug = 'atg')
where role in ('organizer', 'judge', 'head_judge') and organization_id is null;

update public.events
set organization_id = (select id from public.organizations where slug = 'atg')
where organization_id is null;

update public.brand_kits
set organization_id = (select id from public.organizations where slug = 'atg')
where organization_id is null;

update public.series
set organization_id = (select id from public.organizations where slug = 'atg')
where organization_id is null;

alter table public.events      alter column organization_id set not null;
alter table public.brand_kits  alter column organization_id set not null;
alter table public.series      alter column organization_id set not null;

-- FILL IN BEFORE RUNNING IN PRODUCTION:
-- update public.profiles set role = 'platform_admin', organization_id = null
-- where email = 'martin@roboticsleague.co.za';

-- ------------------------------------------------------------
-- 7. Helper functions
-- ------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'platform_admin'
  );
$$;

create or replace function public.my_organization_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

-- True if the caller is organizer/head_judge for the given org AND
-- that org is active. Suspending an org revokes this immediately —
-- the actual teeth of the platform-admin toggle.
create or replace function public.is_privileged_for(org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles p
    join public.organizations o on o.id = p.organization_id
    where p.id = auth.uid()
      and p.role in ('organizer', 'head_judge')
      and p.organization_id = org_id
      and o.status = 'active'
  );
$$;

-- Organizer only (not head_judge) for the given org, active org.
create or replace function public.is_organizer_for(org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles p
    join public.organizations o on o.id = p.organization_id
    where p.id = auth.uid()
      and p.role = 'organizer'
      and p.organization_id = org_id
      and o.status = 'active'
  );
$$;

-- ------------------------------------------------------------
-- 8. organizations — platform_admin manages; an org's own
--    organizer/head_judge can read (but not write) their own row,
--    e.g. to show a "your account is suspended" banner.
-- ------------------------------------------------------------
drop policy if exists "organizations_select" on public.organizations;
drop policy if exists "organizations_write" on public.organizations;
create policy "organizations_select" on public.organizations
  for select to authenticated using (
    public.is_platform_admin() or id = public.my_organization_id()
  );
create policy "organizations_write" on public.organizations
  for all to authenticated using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ------------------------------------------------------------
-- 9. events — public reads published/live/archived (unchanged);
--    organizer/head_judge reads+writes only their own org's events;
--    platform_admin sees/writes everything.
-- ------------------------------------------------------------
drop policy if exists "events_select_organizer" on public.events;
drop policy if exists "events_write" on public.events;
create policy "events_select_organizer" on public.events
  for select to authenticated using (
    public.is_privileged_for(organization_id) or public.is_platform_admin()
  );
create policy "events_write" on public.events
  for all to authenticated using (
    public.is_organizer_for(organization_id) or public.is_platform_admin()
  ) with check (
    public.is_organizer_for(organization_id) or public.is_platform_admin()
  );

-- ------------------------------------------------------------
-- 10. profiles — this is the actual PII fix: an organizer/head_judge
--     now only sees profiles within their own org (plus their own
--     row), not every profile platform-wide. platform_admin sees all.
-- ------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (
    public.is_platform_admin()
    or id = auth.uid()
    or (organization_id is not null and organization_id = public.my_organization_id())
  );

-- ------------------------------------------------------------
-- 11. divisions — public read unchanged; write scoped via events.
-- ------------------------------------------------------------
drop policy if exists "divisions_write" on public.divisions;
create policy "divisions_write" on public.divisions
  for all to authenticated using (
    exists (
      select 1 from public.events e
      where e.id = divisions.event_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  ) with check (
    exists (
      select 1 from public.events e
      where e.id = divisions.event_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  );

-- ------------------------------------------------------------
-- 12. registrations — scoped via events.
-- ------------------------------------------------------------
drop policy if exists "registrations_select" on public.registrations;
drop policy if exists "registrations_organizer_write" on public.registrations;
create policy "registrations_select" on public.registrations
  for select to authenticated using (
    id in (select public.my_registration_ids())
    or exists (
      select 1 from public.events e
      where e.id = registrations.event_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  );
create policy "registrations_organizer_write" on public.registrations
  for all to authenticated using (
    exists (
      select 1 from public.events e
      where e.id = registrations.event_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  ) with check (
    exists (
      select 1 from public.events e
      where e.id = registrations.event_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  );

-- ------------------------------------------------------------
-- 13. registration_athletes — scoped via registrations -> events.
-- ------------------------------------------------------------
drop policy if exists "registration_athletes_select" on public.registration_athletes;
drop policy if exists "registration_athletes_organizer_write" on public.registration_athletes;
create policy "registration_athletes_select" on public.registration_athletes
  for select to authenticated using (
    profile_id = auth.uid()
    or registration_id in (select public.my_registration_ids())
    or exists (
      select 1 from public.registrations r
      join public.events e on e.id = r.event_id
      where r.id = registration_athletes.registration_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  );
create policy "registration_athletes_organizer_write" on public.registration_athletes
  for all to authenticated using (
    exists (
      select 1 from public.registrations r
      join public.events e on e.id = r.event_id
      where r.id = registration_athletes.registration_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  ) with check (
    exists (
      select 1 from public.registrations r
      join public.events e on e.id = r.event_id
      where r.id = registration_athletes.registration_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  );

-- ------------------------------------------------------------
-- 14. heats / heat_assignments — public read unchanged (heat
--     sheet); write scoped via events.
-- ------------------------------------------------------------
drop policy if exists "heats_write" on public.heats;
create policy "heats_write" on public.heats
  for all to authenticated using (
    exists (
      select 1 from public.events e
      where e.id = heats.event_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  ) with check (
    exists (
      select 1 from public.events e
      where e.id = heats.event_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  );

drop policy if exists "heat_assignments_write" on public.heat_assignments;
create policy "heat_assignments_write" on public.heat_assignments
  for all to authenticated using (
    exists (
      select 1 from public.heats h
      join public.events e on e.id = h.event_id
      where h.id = heat_assignments.heat_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  ) with check (
    exists (
      select 1 from public.heats h
      join public.events e on e.id = h.event_id
      where h.id = heat_assignments.heat_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  );

-- ------------------------------------------------------------
-- 15. judge_assignments — organizer of the owning org manages
--     (matches pre-migration behavior: only requireOrganizer()
--     app actions ever wrote this table, head_judge was never
--     widened onto it); judge reads own.
-- ------------------------------------------------------------
drop policy if exists "judge_assignments_select" on public.judge_assignments;
drop policy if exists "judge_assignments_write" on public.judge_assignments;
create policy "judge_assignments_select" on public.judge_assignments
  for select to authenticated using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.heats h
      join public.events e on e.id = h.event_id
      where h.id = judge_assignments.heat_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  );
create policy "judge_assignments_write" on public.judge_assignments
  for all to authenticated using (
    exists (
      select 1 from public.heats h
      join public.events e on e.id = h.event_id
      where h.id = judge_assignments.heat_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  ) with check (
    exists (
      select 1 from public.heats h
      join public.events e on e.id = h.event_id
      where h.id = judge_assignments.heat_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  );

-- ------------------------------------------------------------
-- 16. scores — judge insert scoped to own assigned heats (already
--     org-scoped transitively via judge_assignments); privileged
--     access scoped via events.
-- ------------------------------------------------------------
drop policy if exists "scores_privileged_all" on public.scores;
create policy "scores_privileged_all" on public.scores
  for all to authenticated using (
    exists (
      select 1
      from public.heat_assignments ha
      join public.heats h  on h.id = ha.heat_id
      join public.events e on e.id = h.event_id
      where ha.id = scores.heat_assignment_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  ) with check (
    exists (
      select 1
      from public.heat_assignments ha
      join public.heats h  on h.id = ha.heat_id
      join public.events e on e.id = h.event_id
      where ha.id = scores.heat_assignment_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  );

-- ------------------------------------------------------------
-- 17. brand_kits — public read unchanged (needed on public event/
--     registration pages); write scoped to owning org directly.
-- ------------------------------------------------------------
drop policy if exists "brand_kits_write" on public.brand_kits;
create policy "brand_kits_write" on public.brand_kits
  for all to authenticated using (
    public.is_organizer_for(organization_id) or public.is_platform_admin()
  ) with check (
    public.is_organizer_for(organization_id) or public.is_platform_admin()
  );

-- ------------------------------------------------------------
-- 18. series / series_events — read stays authenticated-wide (an
--     athlete reading season points for their own org's series is
--     the migration-025 use case); write scoped to owning org.
-- ------------------------------------------------------------
drop policy if exists "series_organizer_all" on public.series;
create policy "series_organizer_all" on public.series
  for all to authenticated using (
    public.is_organizer_for(organization_id) or public.is_platform_admin()
  ) with check (
    public.is_organizer_for(organization_id) or public.is_platform_admin()
  );

drop policy if exists "series_events_organizer_all" on public.series_events;
create policy "series_events_organizer_all" on public.series_events
  for all to authenticated using (
    exists (
      select 1 from public.series s
      where s.id = series_events.series_id
        and (public.is_organizer_for(s.organization_id) or public.is_platform_admin())
    )
  ) with check (
    exists (
      select 1 from public.series s
      where s.id = series_events.series_id
        and (public.is_organizer_for(s.organization_id) or public.is_platform_admin())
    )
  );

-- ------------------------------------------------------------
-- 19. team_invites — scoped via registrations -> events (captain/
--     athlete side unchanged).
-- ------------------------------------------------------------
drop policy if exists "team_invites_select" on public.team_invites;
drop policy if exists "team_invites_write" on public.team_invites;
create policy "team_invites_select" on public.team_invites
  for select to authenticated using (
    registration_id in (select public.my_registration_ids())
    or exists (
      select 1 from public.registrations r
      join public.events e on e.id = r.event_id
      where r.id = team_invites.registration_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  );
create policy "team_invites_write" on public.team_invites
  for all to authenticated using (
    registration_id in (select public.my_registration_ids())
    or exists (
      select 1 from public.registrations r
      join public.events e on e.id = r.event_id
      where r.id = team_invites.registration_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  ) with check (
    registration_id in (select public.my_registration_ids())
    or exists (
      select 1 from public.registrations r
      join public.events e on e.id = r.event_id
      where r.id = team_invites.registration_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  );

-- ------------------------------------------------------------
-- 20. org_invites — platform_admin manages fully. An org's own
--     organizer can view invites sent for their org (so they can
--     see "invite pending" state), but not create/modify — invites
--     are issued by the platform admin only.
-- ------------------------------------------------------------
drop policy if exists "org_invites_select" on public.org_invites;
drop policy if exists "org_invites_write" on public.org_invites;
create policy "org_invites_select" on public.org_invites
  for select to authenticated using (
    public.is_platform_admin() or organization_id = public.my_organization_id()
  );
create policy "org_invites_write" on public.org_invites
  for all to authenticated using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ------------------------------------------------------------
-- 21. storage: event-posters — write restricted to the org that
--     owns the event the poster belongs to (path is "${eventId}/
--     poster-....ext", see EventDetailsForm.tsx). Previously any
--     organizer could write to any event's poster path.
-- ------------------------------------------------------------
drop policy if exists "event_posters_write" on storage.objects;
create policy "event_posters_write" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'event-posters'
    and (
      public.is_platform_admin()
      or exists (
        select 1 from public.events e
        where e.id::text = (storage.foldername(name))[1]
          and public.is_organizer_for(e.organization_id)
      )
    )
  )
  with check (
    bucket_id = 'event-posters'
    and (
      public.is_platform_admin()
      or exists (
        select 1 from public.events e
        where e.id::text = (storage.foldername(name))[1]
          and public.is_organizer_for(e.organization_id)
      )
    )
  );
