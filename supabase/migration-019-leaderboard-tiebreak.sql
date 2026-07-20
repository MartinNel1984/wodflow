-- ============================================================
-- Wodflow — migration 019: expose tiebreak_value on the public leaderboard
--
-- Milestone 12 already captures tiebreak_value on scores; Milestone 17
-- teaches the leaderboard math to actually use it. CREATE OR REPLACE
-- VIEW requires new columns to be appended at the end, not inserted
-- among the existing ones, hence tiebreak_value trailing display_name
-- here rather than sitting next to value_raw.
-- ============================================================

create or replace view public.public_leaderboard
with (security_invoker = false) as
select distinct on (s.heat_assignment_id, s.workout_id)
  s.heat_assignment_id,
  s.workout_id,
  s.value_raw,
  ha.registration_id,
  r.division_id,
  coalesce(
    r.team_name,
    (
      select ra.full_name
      from public.registration_athletes ra
      where ra.registration_id = r.id and ra.is_captain
      limit 1
    )
  ) as display_name,
  s.tiebreak_value
from public.scores s
join public.heat_assignments ha on ha.id = s.heat_assignment_id
join public.registrations r on r.id = ha.registration_id
order by s.heat_assignment_id, s.workout_id, s.submitted_at desc;

grant select on public.public_leaderboard to anon, authenticated;
