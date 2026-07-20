-- ============================================================
-- Wodflow — migration 011: team invites
--
-- Schema only for Milestone 9 — the actual invite-send/accept flow is
-- Milestone 15. token is the accept-link secret; the accept action
-- will run through the service client (same pattern as the existing
-- registrations API route, since an invitee may not have an account
-- yet), so RLS here only needs to cover the captain/organizer side:
-- creating and viewing invites for a registration you own.
-- ============================================================

create table if not exists public.team_invites (
  id                  uuid primary key default gen_random_uuid(),
  registration_id     uuid not null references public.registrations(id) on delete cascade,
  email_or_phone      text not null,
  status              text not null default 'pending'
                        check (status in ('pending', 'accepted', 'expired')),
  token               uuid not null default gen_random_uuid(),
  invited_by          uuid references public.profiles(id),
  accepted_profile_id uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  accepted_at         timestamptz
);

alter table public.team_invites enable row level security;

drop policy if exists "team_invites_select" on public.team_invites;
drop policy if exists "team_invites_write" on public.team_invites;
create policy "team_invites_select" on public.team_invites
  for select to authenticated using (
    public.is_organizer()
    or registration_id in (select public.my_registration_ids())
  );
create policy "team_invites_write" on public.team_invites
  for all to authenticated using (
    public.is_organizer()
    or registration_id in (select public.my_registration_ids())
  ) with check (
    public.is_organizer()
    or registration_id in (select public.my_registration_ids())
  );
