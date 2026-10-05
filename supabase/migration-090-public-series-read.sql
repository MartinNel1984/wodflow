-- Wodflow — migration 090: public read on series + series_events
--
-- Milestone 18's public Rumble Series leaderboard (/rumble-series/[id]/leaderboard)
-- needs anon read on both tables to look up the series' name, year,
-- points_config, and its linked event list. migration-012 deliberately
-- held this back ("no public read policy until Milestone 18 actually
-- builds a season leaderboard to show") — we're building it now.
--
-- Only non-sensitive columns are involved (series name/year, points
-- formula, and event-id mappings). Writes stay organiser-only.

drop policy if exists "series_public_read" on public.series;
create policy "series_public_read" on public.series
  for select to anon using (true);

drop policy if exists "series_events_public_read" on public.series_events;
create policy "series_events_public_read" on public.series_events
  for select to anon using (true);
