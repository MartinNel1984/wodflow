-- ============================================================
-- Wodflow — migration 072: revoke stray write grants on latest_scores
--
-- migration-034 revoked SELECT on the latest_scores view from anon
-- but never touched INSERT/UPDATE/REFERENCES, which were left
-- granted to both anon and authenticated. Found during an RLS audit
-- 2026-08-14. Not currently exploitable — the view uses DISTINCT ON,
-- which Postgres treats as non-simple/non-updatable, so any write
-- attempt fails at the planner regardless of grants — but the stray
-- grants are misleading and should be cleaned up.
--
-- Run in the Supabase SQL Editor in one go. Safe to re-run.
-- ============================================================

revoke insert, update, references on public.latest_scores from anon, authenticated;
