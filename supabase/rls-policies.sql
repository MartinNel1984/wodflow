-- ============================================================
-- Wodflow — Row Level Security
-- Run AFTER schema.sql and judge-pin-login.sql. Safe to re-run.
--
-- Three roles (profiles.role):
--   organizer  — everything: events, divisions, heats, scores, PII
--   judge      — insert scores, only for heats they're assigned to
--   athlete    — read/update only their own registration + waiver
--
-- Public (anon, no login) can read published event/division/heat/
-- leaderboard data, but never registrations/registration_athletes
-- (contains PII) and never raw scores (only the public_leaderboard
-- view, which excludes judge identity).
-- ============================================================

alter table public.events                 enable row level security;
alter table public.profiles               enable row level security;
alter table public.divisions              enable row level security;
alter table public.registrations          enable row level security;
alter table public.registration_athletes  enable row level security;
alter table public.heats                  enable row level security;
alter table public.heat_assignments       enable row level security;
alter table public.judge_assignments      enable row level security;
alter table public.scores                 enable row level security;

-- ------------------------------------------------------------
-- 1. Helper functions
-- ------------------------------------------------------------
create or replace function public.is_organizer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'organizer'
  );
$$;

create or replace function public.is_judge()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'judge'
  );
$$;

-- Heats the calling judge is scoped to.
create or replace function public.my_assigned_heat_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select heat_id from public.judge_assignments where profile_id = auth.uid();
$$;

-- Registrations the calling athlete belongs to (as captain or teammate).
create or replace function public.my_registration_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select registration_id from public.registration_athletes where profile_id = auth.uid()
  union
  select id from public.registrations where captain_profile_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 2. events — public reads published/live events; organizer writes
-- ------------------------------------------------------------
drop policy if exists "events_select_public" on public.events;
drop policy if exists "events_select_organizer" on public.events;
drop policy if exists "events_write" on public.events;
create policy "events_select_public" on public.events
  for select to anon, authenticated using (status in ('published', 'live', 'archived'));
create policy "events_select_organizer" on public.events
  for select to authenticated using (public.is_organizer());
create policy "events_write" on public.events
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

-- ------------------------------------------------------------
-- 3. profiles — organizer sees all; everyone sees their own row
-- ------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (public.is_organizer() or id = auth.uid());
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ------------------------------------------------------------
-- 4. divisions — public reads; organizer writes
-- ------------------------------------------------------------
drop policy if exists "divisions_select" on public.divisions;
drop policy if exists "divisions_write" on public.divisions;
create policy "divisions_select" on public.divisions
  for select to anon, authenticated using (true);
create policy "divisions_write" on public.divisions
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

-- ------------------------------------------------------------
-- 5. registrations — contains PII, no anon access.
--    athlete sees/updates own; organizer sees/writes all.
--    Inserts happen via the registrations API route using the
--    service client (registration is pre-signup for teammates),
--    so no separate "insert" policy is needed for anon/athlete.
-- ------------------------------------------------------------
drop policy if exists "registrations_select" on public.registrations;
drop policy if exists "registrations_update" on public.registrations;
drop policy if exists "registrations_organizer_write" on public.registrations;
create policy "registrations_select" on public.registrations
  for select to authenticated using (
    public.is_organizer() or id in (select public.my_registration_ids())
  );
create policy "registrations_update" on public.registrations
  for update to authenticated using (
    id in (select public.my_registration_ids())
  ) with check (
    id in (select public.my_registration_ids())
  );
create policy "registrations_organizer_write" on public.registrations
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

-- ------------------------------------------------------------
-- 6. registration_athletes — same visibility boundary as
--    registrations; waiver ack is the main athlete-writable field.
-- ------------------------------------------------------------
drop policy if exists "registration_athletes_select" on public.registration_athletes;
drop policy if exists "registration_athletes_update" on public.registration_athletes;
drop policy if exists "registration_athletes_organizer_write" on public.registration_athletes;
create policy "registration_athletes_select" on public.registration_athletes
  for select to authenticated using (
    public.is_organizer()
    or profile_id = auth.uid()
    or registration_id in (select public.my_registration_ids())
  );
create policy "registration_athletes_update" on public.registration_athletes
  for update to authenticated using (
    profile_id = auth.uid()
  ) with check (
    profile_id = auth.uid()
  );
create policy "registration_athletes_organizer_write" on public.registration_athletes
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

-- ------------------------------------------------------------
-- 7. heats / heat_assignments — public reads (heat sheet);
--    organizer writes; judges read their own assignments.
-- ------------------------------------------------------------
drop policy if exists "heats_select" on public.heats;
drop policy if exists "heats_write" on public.heats;
create policy "heats_select" on public.heats
  for select to anon, authenticated using (true);
create policy "heats_write" on public.heats
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

drop policy if exists "heat_assignments_select" on public.heat_assignments;
drop policy if exists "heat_assignments_write" on public.heat_assignments;
create policy "heat_assignments_select" on public.heat_assignments
  for select to anon, authenticated using (true);
create policy "heat_assignments_write" on public.heat_assignments
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

-- ------------------------------------------------------------
-- 8. judge_assignments — organizer manages; judge reads own.
-- ------------------------------------------------------------
drop policy if exists "judge_assignments_select" on public.judge_assignments;
drop policy if exists "judge_assignments_write" on public.judge_assignments;
create policy "judge_assignments_select" on public.judge_assignments
  for select to authenticated using (public.is_organizer() or profile_id = auth.uid());
create policy "judge_assignments_write" on public.judge_assignments
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

-- ------------------------------------------------------------
-- 9. scores — judge inserts only for their assigned heats;
--    no update/delete policy (corrections are new rows, see
--    schema.sql comment on latest_scores); organizer full access;
--    no direct anon/authenticated select — reads go through the
--    public_leaderboard view instead (created in a later migration
--    once rank computation is defined).
-- ------------------------------------------------------------
drop policy if exists "scores_insert_judge" on public.scores;
drop policy if exists "scores_organizer_all" on public.scores;
create policy "scores_insert_judge" on public.scores
  for insert to authenticated with check (
    public.is_judge()
    and heat_assignment_id in (
      select ha.id from public.heat_assignments ha
      where ha.heat_id in (select public.my_assigned_heat_ids())
    )
  );
create policy "scores_organizer_all" on public.scores
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());
