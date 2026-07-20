-- ============================================================
-- Wodflow — migration 014: centralized scoring + heat-lock RLS
--
-- Two changes to who can insert scores:
--
-- 1. Distributed-mode judges lose insert rights the instant a heat is
--    marked 'completed' (the lock event, mirroring Wodify's "End of
--    Judging") — enforced here in Postgres, not just hidden in the
--    UI, so it can't be bypassed by calling the API directly.
-- 2. In centralized-mode events, regular judges never had insert
--    rights in the first place — only head_judge/organizer score.
--    scores_insert_judge below folds both rules into one WHERE.
--
-- head_judge gets the same unrestricted access organizer already had
-- (scores_organizer_all is widened into scores_privileged_all) —
-- corrections after a heat is locked are just another insert, since
-- scores is already append-only with latest-submitted_at-wins
-- (see schema.sql's comment on latest_scores). No new correction
-- workflow needed at the DB level; the UI's confirm-before-correcting
-- step (Milestone 12) is a UX guard, not an RLS one.
-- ============================================================

drop policy if exists "scores_insert_judge" on public.scores;
create policy "scores_insert_judge" on public.scores
  for insert to authenticated with check (
    public.is_judge()
    and heat_assignment_id in (
      select ha.id
      from public.heat_assignments ha
      join public.heats h      on h.id = ha.heat_id
      join public.divisions d  on d.id = h.division_id
      join public.events e     on e.id = d.event_id
      where ha.heat_id in (select public.my_assigned_heat_ids())
        and h.status <> 'completed'
        and e.judging_mode = 'distributed'
    )
  );

drop policy if exists "scores_organizer_all" on public.scores;
drop policy if exists "scores_privileged_all" on public.scores;
create policy "scores_privileged_all" on public.scores
  for all to authenticated using (
    public.is_organizer() or public.is_head_judge()
  ) with check (
    public.is_organizer() or public.is_head_judge()
  );
