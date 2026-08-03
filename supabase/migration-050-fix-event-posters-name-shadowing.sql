-- Wodflow — migration 050: fix column-name shadowing bug in event_posters_write
--
-- Same bug migration-041 fixed for brand_kit_logos_write and
-- hub_photos_bucket_write, but event_posters_write (added in
-- migration-026) has the identical shape and was missed: its EXISTS
-- subquery joins `public.events e` — which also has a `name` column
-- (the event's display name) — and references bare `name` inside
-- `storage.foldername(name)`. Per normal SQL scoping, the innermost
-- scope wins, so `name` resolved to `e.name` instead of
-- `storage.objects.name` (the file path), making the check always
-- false for any real upload. Symptom: "new row violates row-level
-- security policy" on every poster upload, for every organizer,
-- regardless of login state — logging out and back in never could
-- have fixed it.
--
-- Fix: qualify as `objects.name`, exactly like migration-041.

drop policy if exists "event_posters_write" on storage.objects;
create policy "event_posters_write" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'event-posters'
    and (
      public.is_platform_admin()
      or exists (
        select 1 from public.events e
        where e.id::text = (storage.foldername(objects.name))[1]
          and public.is_organizer_for(e.organization_id)
      )
    )
  )
  with check (
    bucket_id = 'event-posters'
    and (
      public.is_platform_admin()
      or exists (
        select 1 from public.events e
        where e.id::text = (storage.foldername(objects.name))[1]
          and public.is_organizer_for(e.organization_id)
      )
    )
  );
