-- ============================================================
-- Wodflow — migration 009: scores gain RX/Scaled, tiebreak, workout link
--
-- workout_ref_id is deliberately ADDITIVE and nullable — the existing
-- free-text workout_id column is left untouched so already-live
-- scores (including the rehearsal data Tjokkie is currently reviewing
-- on wodflow.co.za) keep rendering exactly as before. Once the
-- workout builder (Milestone 11) is in use, new scores can populate
-- workout_ref_id; the leaderboard can prefer it when present and fall
-- back to the legacy text workout_id otherwise. No backfill of old
-- rows — they're rehearsal/demo data, not real competition history.
-- ============================================================

alter table public.scores
  add column if not exists rx_or_scaled text check (rx_or_scaled in ('rx', 'scaled')),
  add column if not exists tiebreak_value jsonb,
  add column if not exists workout_ref_id uuid references public.workouts(id);
