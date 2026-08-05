-- Wodflow — migration 058: historical events ("Past Rumbles")
--
-- Rumble Series events run before/outside Wodflow (Indy, Big Rumble in
-- Randburg, ...) already get their placements recorded in
-- historical_results (migration-051) so they count toward the season
-- leaderboard. This adds a lightweight parent record per event — name,
-- logo, date — purely for a public "Past Rumbles" page (click a logo,
-- see that event's results) so it doesn't have to be reconstructed by
-- grouping historical_results.event_name strings. historical_results
-- gains an optional FK to it; existing/unlinked rows keep working as
-- today, grouped by event_name text only.

create table if not exists public.historical_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  logo_path       text,
  event_date      date,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists historical_events_org_idx on public.historical_events (organization_id);

alter table public.historical_results
  add column if not exists historical_event_id uuid references public.historical_events(id) on delete set null;

create index if not exists historical_results_event_idx on public.historical_results (historical_event_id);

alter table public.historical_events enable row level security;

drop policy if exists "historical_events_organizer_write" on public.historical_events;
create policy "historical_events_organizer_write" on public.historical_events
  for all to authenticated
  using (public.is_organizer_for(organization_id))
  with check (public.is_organizer_for(organization_id));

-- Public: the whole point of the Past Rumbles page is anonymous
-- visitors browsing past events, same trust boundary as
-- public_leaderboard/public_heat_sheet.
drop policy if exists "historical_events_public_read" on public.historical_events;
create policy "historical_events_public_read" on public.historical_events
  for select to anon, authenticated
  using (true);

-- Public results-by-event view, no email exposed — same shape as
-- public_historical_placements (migration-057) but keyed for the
-- public Past Rumbles page rather than season-ranking, so it can be
-- read anonymously.
create or replace view public.public_historical_event_results
with (security_invoker = false) as
select
  hr.historical_event_id,
  hr.event_name,
  hr.division_name,
  hr.team_name,
  hr.athlete_name,
  hr.position,
  hr.entrants,
  hr.gender,
  hr.season_tier
from public.historical_results hr
where hr.historical_event_id is not null;

grant select on public.public_historical_event_results to anon, authenticated;

-- Storage bucket for event logos, public read (displayed on the
-- public Past Rumbles page), organizer-only write. Same
-- foldername-scoping pattern as event-posters (migration-026, fixed
-- for column-name shadowing in migration-050) — path is
-- <historical_event_id>/<filename>. Deliberately qualified as
-- `objects.name` (not bare `name`) since historical_events also has
-- its own `name` column and would otherwise shadow it under the
-- EXISTS subquery's scoping rules, exactly the bug migration-050 fixed.
insert into storage.buckets (id, name, public)
values ('historical-event-logos', 'historical-event-logos', true)
on conflict (id) do nothing;

drop policy if exists "historical_event_logos_public_read" on storage.objects;
create policy "historical_event_logos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'historical-event-logos');

drop policy if exists "historical_event_logos_write" on storage.objects;
create policy "historical_event_logos_write" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'historical-event-logos'
    and (
      public.is_platform_admin()
      or exists (
        select 1 from public.historical_events he
        where he.id::text = (storage.foldername(objects.name))[1]
          and public.is_organizer_for(he.organization_id)
      )
    )
  )
  with check (
    bucket_id = 'historical-event-logos'
    and (
      public.is_platform_admin()
      or exists (
        select 1 from public.historical_events he
        where he.id::text = (storage.foldername(objects.name))[1]
          and public.is_organizer_for(he.organization_id)
      )
    )
  );
