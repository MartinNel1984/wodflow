-- ============================================================
-- Wodflow — migration 025: athlete-facing season points read access
--
-- migration-012 left series/series_events organizer-only, deferring a
-- public read policy until something actually needed to show season
-- standings to athletes. That's now: the portal dashboard's "Season
-- rank" stat needs to read which events count toward the season and
-- how points are weighted (points_config) for the athlete's own
-- profile — writes stay organizer-only via the existing
-- "series_organizer_all" / "series_events_organizer_all" policies.
-- ============================================================

drop policy if exists "series_authenticated_read" on public.series;
create policy "series_authenticated_read" on public.series
  for select to authenticated using (true);

drop policy if exists "series_events_authenticated_read" on public.series_events;
create policy "series_events_authenticated_read" on public.series_events
  for select to authenticated using (true);
