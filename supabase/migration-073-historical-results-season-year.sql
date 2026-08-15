-- Wodflow — migration 073: scope historical results to a season year
--
-- historical_results had no year field at all, so season rank
-- (migration-051) summed points across every historical event ever
-- entered with no way to separate seasons — Martin: season rank should
-- only count the current year's comps, rolling forward each year (2026
-- now, 2027 next). Backfilled from the trailing year already baked into
-- each event_name (e.g. "Remix 2026" -> 2026), since that's the only
-- place the year currently lives on existing rows.

alter table public.historical_results
  add column if not exists season_year int;

update public.historical_results
set season_year = substring(event_name from '(\d{4})$')::int
where season_year is null;

alter table public.historical_results
  alter column season_year set not null;

-- CREATE OR REPLACE VIEW can only append columns at the end (Postgres
-- 42P16) — drop and recreate, same pattern as migration-057.
drop view if exists public.public_historical_placements;

create view public.public_historical_placements
with (security_invoker = false) as
select
  hr.id,
  p.id as profile_id,
  hr.athlete_name as display_name,
  hr.event_name,
  hr.division_name,
  hr.position,
  hr.entrants,
  hr.gender,
  hr.season_tier,
  hr.season_year,
  lower(hr.athlete_email) as athlete_email
from public.historical_results hr
left join public.profiles p on lower(p.email) = lower(hr.athlete_email);

grant select on public.public_historical_placements to authenticated;
