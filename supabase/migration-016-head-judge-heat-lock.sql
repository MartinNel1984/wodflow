-- ============================================================
-- Wodflow — migration 016: head_judge can lock/unlock heats
--
-- Milestone 12 needs the head_judge (Tjokkie, "Main Judge") to mark a
-- heat completed (the lock event from migration-014/015) themselves,
-- not depend on the organizer account for it — heats_write previously
-- only granted organizer. Widened the same way scores_privileged_all
-- already covers organizer OR head_judge.
-- ============================================================

drop policy if exists "heats_write" on public.heats;
create policy "heats_write" on public.heats
  for all to authenticated using (
    public.is_organizer() or public.is_head_judge()
  ) with check (
    public.is_organizer() or public.is_head_judge()
  );
