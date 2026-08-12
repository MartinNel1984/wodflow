-- ============================================================
-- Wodflow — migration 062: tag hub_photos to a historical event too
--
-- migration-061 added hub_photos.event_id (references public.events),
-- but Tjokkie's first real photo dump (Big Rumble 2025, Rumble Indy
-- 2025 — ~3,275 photos) is for events run before Wodflow existed,
-- which live in public.historical_events (migration-058), not
-- public.events. A photo can belong to one or the other, never both.
-- ============================================================

alter table public.hub_photos
  add column if not exists historical_event_id uuid references public.historical_events(id) on delete set null;

create index if not exists hub_photos_historical_event_id_idx on public.hub_photos(historical_event_id);

alter table public.hub_photos
  add constraint hub_photos_one_event_check
  check (event_id is null or historical_event_id is null);
