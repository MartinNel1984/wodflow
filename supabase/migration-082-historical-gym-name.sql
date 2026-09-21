-- Wodflow — migration 082: gym on historical results
--
-- Organizers want to see which gym each athlete is from, including for
-- events run outside Wodflow (Indy, Remix). historical_results only had
-- a placement per athlete, so add an optional free-text gym_name, same
-- shape as profiles.gym_name / registration_athletes.gym_name
-- (migration-060). Existing organizer-write RLS already covers it, and
-- public_historical_placements is untouched so nothing new is exposed
-- to anon.
alter table public.historical_results
  add column if not exists gym_name text;

-- Backfill from the athlete's own profile where the email matches and
-- they've already filled in a gym. Never overwrites a gym typed on the
-- row itself.
update public.historical_results hr
   set gym_name = p.gym_name
  from public.profiles p
 where hr.gym_name is null
   and p.gym_name is not null
   and btrim(p.gym_name) <> ''
   and lower(p.email) = lower(hr.athlete_email);
