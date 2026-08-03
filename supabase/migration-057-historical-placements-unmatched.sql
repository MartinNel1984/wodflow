-- Wodflow — migration 057: show historical results even before the
-- athlete has signed up on Wodflow
--
-- public_historical_placements (migration-051) inner-joined profiles,
-- so an athlete who placed at Indy/Remix but hasn't created a Wodflow
-- account yet was silently excluded from the season leaderboard
-- entirely. Martin: "if a Ruan Potgieter is first he is first" —
-- placement is placement, whether or not they've signed up. Switched
-- to a left join so unmatched rows still come through (profile_id
-- null, using the sheet's own name as the display name until they
-- sign up), and exposed athlete_email so the ranking code can fall
-- back to an email-keyed identity instead of dropping the row. Once
-- someone signs up with the matching email, this view (recomputed
-- live on every read, never a snapshot) automatically picks up their
-- real profile_id on its own — no manual merge/reconciliation step.

create or replace view public.public_historical_placements
with (security_invoker = false) as
select
  hr.id,
  p.id as profile_id,
  lower(hr.athlete_email) as athlete_email,
  hr.athlete_name as display_name,
  hr.event_name,
  hr.division_name,
  hr.position,
  hr.entrants,
  hr.gender,
  hr.season_tier
from public.historical_results hr
left join public.profiles p on lower(p.email) = lower(hr.athlete_email);

grant select on public.public_historical_placements to authenticated;
