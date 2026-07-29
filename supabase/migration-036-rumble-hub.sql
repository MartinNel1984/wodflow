-- ============================================================
-- Wodflow — migration 036: Rumble Series public hub
--
-- Supports the new Rumble-branded landing page at wodflow.co.za root
-- (design: docs/plans/2026-07-29-rumble-series-hub-design.md).
--
-- 1. Fixes a real data bug found during that build: the live "Rumble
--    in Randburg" event (Oct 2-4 2026 — The Big One's dates) was
--    wearing the "Rumble Indy" brand kit (red/orange, individual
--    format) instead of its own blue teams-of-2 kit. Creates the
--    correct kit and reassigns the event.
-- 2. Populates the previously-unused `series` table (schema landed
--    in migration-012, never had a row) so there's a real "Rumble
--    Series 2026" to point a future season leaderboard at.
-- 3. `hub_photos` — carousel photos for the hub. Org-scoped like
--    brand_kits/series (migration-026 landed the day before this —
--    every reusable organizer asset now carries organization_id, so
--    this follows that convention rather than being the one global
--    exception).
-- 4. Storage buckets for brand kit logos and hub photos, following
--    the `event-posters` pattern from migration-024, write access
--    scoped the same org-aware way as migration-026's storage policy.
-- ============================================================

-- 1. Correct brand kit for The Big One
-- (brand_kits.name has no unique constraint, so guard idempotency
-- explicitly rather than relying on a no-op ON CONFLICT clause.)
insert into public.brand_kits (name, color_primary, color_secondary, color_accent, tagline, organization_id)
select 'Rumble Big One', '#3552A4', '#00AEEF', '#2E3192', 'Yeeeah! Get Some!',
       (select id from public.organizations where slug = 'atg')
where not exists (select 1 from public.brand_kits where name = 'Rumble Big One');

update public.events
set brand_kit_id = (select id from public.brand_kits where name = 'Rumble Big One')
where name = 'Rumble in Randburg';

-- 2. Series
insert into public.series (name, year, organization_id)
select 'Rumble Series 2026', 2026, (select id from public.organizations where slug = 'atg')
where not exists (select 1 from public.series where name = 'Rumble Series 2026');

-- 3. Hub photos (carousel)
create table if not exists public.hub_photos (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  image_url       text not null,
  caption         text,
  sort_order      int not null default 0,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

alter table public.hub_photos enable row level security;

drop policy if exists "hub_photos_select" on public.hub_photos;
drop policy if exists "hub_photos_write" on public.hub_photos;
create policy "hub_photos_select" on public.hub_photos
  for select to anon, authenticated using (true);
create policy "hub_photos_write" on public.hub_photos
  for all to authenticated using (
    public.is_organizer_for(organization_id) or public.is_platform_admin()
  ) with check (
    public.is_organizer_for(organization_id) or public.is_platform_admin()
  );

-- 4. Storage buckets
insert into storage.buckets (id, name, public)
values ('brand-kit-logos', 'brand-kit-logos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('hub-photos', 'hub-photos', true)
on conflict (id) do nothing;

drop policy if exists "brand_kit_logos_select" on storage.objects;
drop policy if exists "brand_kit_logos_write" on storage.objects;
create policy "brand_kit_logos_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'brand-kit-logos');
create policy "brand_kit_logos_write" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'brand-kit-logos'
    and (public.is_organizer_for(public.my_organization_id()) or public.is_platform_admin())
  )
  with check (
    bucket_id = 'brand-kit-logos'
    and (public.is_organizer_for(public.my_organization_id()) or public.is_platform_admin())
  );

drop policy if exists "hub_photos_bucket_select" on storage.objects;
drop policy if exists "hub_photos_bucket_write" on storage.objects;
create policy "hub_photos_bucket_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'hub-photos');
create policy "hub_photos_bucket_write" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'hub-photos'
    and (public.is_organizer_for(public.my_organization_id()) or public.is_platform_admin())
  )
  with check (
    bucket_id = 'hub-photos'
    and (public.is_organizer_for(public.my_organization_id()) or public.is_platform_admin())
  );
