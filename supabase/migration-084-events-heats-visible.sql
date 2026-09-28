-- ============================================================
-- Wodflow — migration 084: separate "heats visible" flag.
--
-- results_visible (migration-065) hides BOTH the public leaderboard and
-- the public heat sheet. Tjokkie (2026-09-28) wants heats live on the
-- Rumble page and athlete portal before the event, while the leaderboard
-- stays hidden until scores are coming in. heats_visible gates only
-- app/heats/[divisionId]; results_visible keeps gating the leaderboard.
--
-- Backfilled from results_visible so nothing changes visibility by
-- itself: the Big One's heats stay hidden until an organizer flips the
-- new toggle. Default true so future events behave as before.
-- ============================================================

alter table public.events
  add column if not exists heats_visible boolean not null default true;

update public.events set heats_visible = results_visible;
