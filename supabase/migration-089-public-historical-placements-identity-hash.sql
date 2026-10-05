-- Wodflow — migration 089: swap athlete_email for identity_hash on public_historical_placements
--
-- Phase 1 of the public Rumble Series leaderboard needs anon read on
-- this view, but migration-076 explicitly revoked that because the view
-- was leaking athlete_email. The only consumer of athlete_email here is
-- lib/seriesStandings.ts, and only as a stable dedup identity for
-- historical rows that haven't been matched to a profile yet. A hash of
-- the email gives the same dedup behavior without exposing the address,
-- so we can drop the leak-prone column, swap in identity_hash, and
-- re-open anon access.

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
  md5(lower(hr.athlete_email)) as identity_hash
from public.historical_results hr
left join public.profiles p on lower(p.email) = lower(hr.athlete_email);

-- Both halves of the revoke+grant pair per the migration-076 lesson —
-- dropping and recreating a view resets it to the default scaffold that
-- re-grants anon ALL by accident.
revoke all on public.public_historical_placements from anon, authenticated;
grant select on public.public_historical_placements to anon, authenticated;
