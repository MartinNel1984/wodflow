-- ============================================================
-- Wodflow — migration 007: event brand kits
--
-- Rumble Series runs 4 sub-competitions (Rumble Series, Remix, Indy,
-- The Big One), each with its own logo + color palette. Modeled as a
-- reusable kit (organizer creates each once, picks one per event
-- forever after) rather than re-entering colors on every event, and
-- kept generic (not hardcoded to Rumble's 4 kits) since Wodflow may
-- serve other boxes later. No PII — safe for anon read, needed on
-- public event/registration/leaderboard pages.
-- ============================================================

create table if not exists public.brand_kits (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,             -- "Rumble Indy", "Rumble Remix"
  logo_url       text,
  color_primary  text,
  color_secondary text,
  color_accent   text,
  tagline        text,                      -- "Yeeeah! Get Some!"
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);

alter table public.events
  add column if not exists brand_kit_id uuid references public.brand_kits(id);

alter table public.brand_kits enable row level security;

drop policy if exists "brand_kits_select" on public.brand_kits;
drop policy if exists "brand_kits_write" on public.brand_kits;
create policy "brand_kits_select" on public.brand_kits
  for select to anon, authenticated using (true);
create policy "brand_kits_write" on public.brand_kits
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());
