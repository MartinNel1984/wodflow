-- Wodflow — migration 039: path-scope hub-photos/brand-kit-logos storage writes
--
-- migration-036's brand_kit_logos_write / hub_photos_bucket_write policies
-- only checked "are you an organizer of SOME active org" — with no check
-- that the object path belongs to that org, unlike event_posters_write
-- (migration-026) which correctly derives ownership from the path via
-- storage.foldername(name). Live-verified: an organizer at one box could
-- overwrite/delete another box's hub photo or brand kit logo.
--
-- Fix: require the first path segment to match the caller's own
-- organization_id (app code updated alongside this migration to actually
-- upload into that folder). Compared as text (not cast to uuid) so a
-- malformed/legacy flat path cleanly fails the check instead of throwing
-- an "invalid input syntax for uuid" error — same defensive style as
-- event_posters_write's `e.id::text = (storage.foldername(name))[1]`.
-- Objects uploaded before this migration are flat (no folder) and simply
-- stop matching any organizer's policy going forward — the app never
-- deletes/overwrites storage objects for these buckets today (only DB
-- rows), so nothing existing breaks; only future writes are scoped.

drop policy if exists "brand_kit_logos_write" on storage.objects;
create policy "brand_kit_logos_write" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'brand-kit-logos'
    and (
      public.is_platform_admin()
      or exists (
        select 1 from public.organizations o
        where o.id::text = (storage.foldername(name))[1]
          and public.is_organizer_for(o.id)
      )
    )
  )
  with check (
    bucket_id = 'brand-kit-logos'
    and (
      public.is_platform_admin()
      or exists (
        select 1 from public.organizations o
        where o.id::text = (storage.foldername(name))[1]
          and public.is_organizer_for(o.id)
      )
    )
  );

drop policy if exists "hub_photos_bucket_write" on storage.objects;
create policy "hub_photos_bucket_write" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'hub-photos'
    and (
      public.is_platform_admin()
      or exists (
        select 1 from public.organizations o
        where o.id::text = (storage.foldername(name))[1]
          and public.is_organizer_for(o.id)
      )
    )
  )
  with check (
    bucket_id = 'hub-photos'
    and (
      public.is_platform_admin()
      or exists (
        select 1 from public.organizations o
        where o.id::text = (storage.foldername(name))[1]
          and public.is_organizer_for(o.id)
      )
    )
  );
