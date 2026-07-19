-- ============================================================
-- Wodflow — migration 003: judges need SELECT on their own scores
--
-- Found via real browser testing (Milestone 5 offline-sync
-- verification): the scores API route uses an upsert with
-- ignoreDuplicates (ON CONFLICT DO NOTHING) so retries are idempotent.
-- Postgres requires SELECT-level row visibility under RLS to evaluate
-- the ON CONFLICT arbiter, even for a brand-new row with no actual
-- conflict — with zero SELECT policy on scores, every upsert from a
-- judge was rejected as an RLS violation, even though the equivalent
-- plain INSERT succeeded. rls-policies.sql's original scores policies
-- only covered organizer (all) and judge (insert-only).
--
-- This also happens to be a legitimate feature, not just a technical
-- workaround: a judge being able to see scores already entered for
-- their own assigned heat is reasonable and useful.
-- ============================================================

drop policy if exists "scores_select_judge" on public.scores;
create policy "scores_select_judge" on public.scores
  for select to authenticated using (
    public.is_judge()
    and heat_assignment_id in (
      select ha.id from public.heat_assignments ha
      where ha.heat_id in (select public.my_assigned_heat_ids())
    )
  );
