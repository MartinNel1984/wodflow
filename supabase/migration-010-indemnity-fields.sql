-- ============================================================
-- Wodflow — migration 010: real indemnity fields
--
-- The real ATG indemnity forms require an ID number and support a
-- minor/guardian signing path. waiver_signed_name/at/ip already exist
-- (Milestone 2) — this adds what's still missing. waiver_text_snapshot
-- captures the exact wording the athlete agreed to at signup time,
-- not a live link to events.waiver_text, so later edits to an event's
-- waiver text can't retroactively change what a past athlete appears
-- to have agreed to — this matters for the "pullable for public
-- liability" use case Tjokkie described.
-- ============================================================

alter table public.registration_athletes
  add column if not exists id_number text,
  add column if not exists is_minor boolean not null default false,
  add column if not exists guardian_name text,
  add column if not exists guardian_id_number text,
  add column if not exists waiver_text_snapshot text;
