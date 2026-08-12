-- ============================================================
-- Wodflow — migration 061: tag hub_photos to an event
--
-- The athlete portal's Photos tab (app/(athlete)/photos) currently
-- just renders the same flat, unordered list of ~10 photos that backs
-- the public homepage carousel — Tjokkie's feedback (2026-08-12) is
-- that this "does not really add value"; he wants athletes to browse
-- and download the full archive of past Rumble photos, organized by
-- event. Existing photos keep event_id null (they still show in the
-- homepage carousel and in a "General" group in the portal archive) —
-- nothing here changes today's marketing carousel.
-- ============================================================

alter table public.hub_photos
  add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists hub_photos_event_id_idx on public.hub_photos(event_id);
