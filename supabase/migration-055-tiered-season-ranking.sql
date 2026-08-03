-- Wodflow — migration 055: tiered, gender-split season ranking
--
-- Martin: wants ONE combined ranking per gender across a tier of
-- divisions (e.g. RX then Not So RX) instead of each division scored
-- independently — RX's last-place finisher should always outscore Not
-- So RX's winner, to incentivize moving up rather than "sandbagging"
-- into an easier division for more points. Both fields are optional —
-- a division/historical result with either left blank just keeps
-- today's independent-per-division scoring untouched.

alter table public.divisions
  add column if not exists gender text check (gender in ('male', 'female')),
  add column if not exists season_tier int check (season_tier > 0);

alter table public.historical_results
  add column if not exists gender text check (gender in ('male', 'female')),
  add column if not exists season_tier int check (season_tier > 0);

-- Season points now credit every teammate on a placed team, not just
-- the captain (Martin: "100 points per person") — computeSeriesStandingsForEvents
-- needs each athlete's own profile_id per registration, not just
-- captain_profile_id. Same non-sensitive-UUID precedent as
-- public_registration_profiles (migration-052) exposing
-- captain_profile_id — profile_id alone resolves to nothing without
-- separate (locked-down) access to the profiles table itself.
create or replace view public.public_team_rosters
with (security_invoker = false) as
select
  ra.registration_id,
  ra.full_name,
  ra.is_captain,
  ra.profile_id
from public.registration_athletes ra;

grant select on public.public_team_rosters to anon, authenticated;

-- public_historical_placements (migration-051) needs gender/season_tier
-- exposed too, so historical results can join the same combined-tier
-- ranking as live Wodflow-scored divisions.
create or replace view public.public_historical_placements
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
  hr.season_tier
from public.historical_results hr
join public.profiles p on lower(p.email) = lower(hr.athlete_email);

grant select on public.public_historical_placements to authenticated;
