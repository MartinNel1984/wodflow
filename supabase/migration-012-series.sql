-- ============================================================
-- Wodflow — migration 012: series (season/BIG leaderboard) — schema only
--
-- For the 2027 Rumble Series. No real urgency to build the UI (that's
-- Milestone 18), but athlete-account persistence is a hard
-- prerequisite for tracking points across events correctly, so the
-- schema goes in now while the rest of the foundation is being laid.
-- points_config lives directly on series (one jsonb column) rather
-- than a separate table — same pluggable-formula shape as
-- divisions.scoring_config, no need for a second table for one column.
-- Organizer-only for now; no public read policy until Milestone 18
-- actually builds a season leaderboard to show.
-- ============================================================

create table if not exists public.series (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,             -- "Rumble Series 2027"
  year          int not null,
  points_config jsonb not null default '{"method": "gap_formula", "winner_points": 100}'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists public.series_events (
  id         uuid primary key default gen_random_uuid(),
  series_id  uuid not null references public.series(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  sequence   int not null default 1,
  unique (series_id, event_id)
);

alter table public.series        enable row level security;
alter table public.series_events enable row level security;

drop policy if exists "series_organizer_all" on public.series;
create policy "series_organizer_all" on public.series
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

drop policy if exists "series_events_organizer_all" on public.series_events;
create policy "series_events_organizer_all" on public.series_events
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());
