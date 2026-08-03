-- Wodflow — migration 051: historical results (events run outside Wodflow)
--
-- Some Rumble Series events (Indy, Remix) were scored before/outside
-- Wodflow, so there's no real registration/heat/score data for them —
-- only a final placement per athlete, as a plain organizer-supplied
-- list (name, email, division, placement, entrant count). This table
-- holds that list. Matched to a real Wodflow athlete purely by email
-- against profiles.email at query time (never stored as a profile_id
-- here) — if an athlete hasn't signed up yet, their rows just sit
-- unmatched until they do, no error, nothing to backfill later.
--
-- Deliberately NOT trying to reconstruct fake heat/score rows to reuse
-- the existing scoring pipeline — we only ever have a final placement
-- for these events, never real per-workout scores, so a lightweight
-- placement-only table is the honest shape of the data.
--
-- organization_id follows the same tenancy model migration-026 set up
-- everywhere else — without it, any organizer on the platform could
-- read/write another org's historical results via is_organizer().

create table if not exists public.historical_results (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_name      text not null,
  division_name   text not null,
  team_name       text,
  athlete_name    text not null,
  athlete_email   text not null,
  position        int not null check (position > 0),
  entrants        int not null check (entrants > 0),
  created_at      timestamptz not null default now()
);

create index if not exists historical_results_email_idx on public.historical_results (lower(athlete_email));
create index if not exists historical_results_org_idx on public.historical_results (organization_id);

alter table public.historical_results enable row level security;

drop policy if exists "historical_results_organizer_write" on public.historical_results;
create policy "historical_results_organizer_write" on public.historical_results
  for all to authenticated
  using (public.is_organizer_for(organization_id))
  with check (public.is_organizer_for(organization_id));

-- An athlete can read their own historical placements (matched by
-- their own logged-in email), same trust boundary as the rest of
-- their portal data — regardless of which org entered the row, since
-- an athlete can compete across multiple boxes/organizers.
drop policy if exists "historical_results_own_select" on public.historical_results;
create policy "historical_results_own_select" on public.historical_results
  for select to authenticated
  using (
    lower(athlete_email) = lower((select email from public.profiles where id = auth.uid()))
  );

-- Season Rank needs every athlete's historical placements to rank the
-- whole field, not just the caller's own (same RLS-visibility problem
-- migration-052 fixes for real registrations) — but historical_results
-- also carries the athlete's raw email, which shouldn't be broadly
-- readable just to compute rankings. This view resolves email -> the
-- matching profile server-side and exposes only the profile_id,
-- never the email itself. Rows with no matching profile (athlete
-- hasn't signed up on Wodflow yet) are simply excluded.
create or replace view public.public_historical_placements
with (security_invoker = false) as
select
  hr.id,
  p.id as profile_id,
  hr.athlete_name as display_name,
  hr.event_name,
  hr.division_name,
  hr.position,
  hr.entrants
from public.historical_results hr
join public.profiles p on lower(p.email) = lower(hr.athlete_email);

grant select on public.public_historical_placements to authenticated;
