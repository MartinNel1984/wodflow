-- ============================================================
-- Wodflow — migration 017: athlete profiles gain an ID number
--
-- Milestone 14: persistent athlete accounts pre-fill future
-- registrations from the profile instead of re-typing every time.
-- registration_athletes.id_number (migration-010) stays the source
-- of truth for what a specific past registration actually recorded —
-- this is just the reusable default for new ones.
-- ============================================================

alter table public.profiles
  add column if not exists id_number text;
