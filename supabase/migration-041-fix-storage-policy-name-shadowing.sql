-- Wodflow — migration 041: fix column-name shadowing bug in migration-039
--
-- migration-039's EXISTS subquery referenced `(storage.foldername(name))[1]`
-- inside `... from public.organizations o where ...` — since organizations
-- ALSO has a `name` column, the bare `name` resolved to `o.name` (the
-- org's display name) instead of `storage.objects.name` (the file path),
-- per normal SQL scoping rules (innermost scope wins). This made the
-- check always false for any real path, which blocked legitimate
-- same-org uploads entirely — caught by re-running the m039 verification
-- script and seeing "Org A can write into its own org folder" fail even
-- though is_organizer_for() was independently confirmed true via RPC.
--
-- Fix: qualify explicitly as `objects.name` (the policy's own table,
-- implicitly aliased as `objects` since it's defined on storage.objects),
-- so it can never be shadowed by a same-named column on any table joined
-- inside the subquery.

drop policy if exists "brand_kit_logos_write" on storage.objects;
create policy "brand_kit_logos_write" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'brand-kit-logos'
    and (
      public.is_platform_admin()
      or exists (
        select 1 from public.organizations o
        where o.id::text = (storage.foldername(objects.name))[1]
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
        where o.id::text = (storage.foldername(objects.name))[1]
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
        where o.id::text = (storage.foldername(objects.name))[1]
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
        where o.id::text = (storage.foldername(objects.name))[1]
          and public.is_organizer_for(o.id)
      )
    )
  );

drop function if exists public.debug_storage_policies();
