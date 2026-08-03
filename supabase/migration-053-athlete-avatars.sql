-- Wodflow — migration 053: athlete profile pictures
--
-- Self-service upload, no organizer moderation (same trust level as
-- everything else an athlete self-manages — waivers, PBs). Path
-- convention is "${profileId}/avatar.${ext}", and the write policy
-- checks that folder segment against auth.uid() directly — no join to
-- any other table, so this can't hit the storage RLS column-name-
-- shadowing bug class (see reference-storage-rls-name-shadowing /
-- migration-041/050): there's no other table's "name" column in scope
-- to shadow storage.objects.name in the first place.

alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('athlete-avatars', 'athlete-avatars', true)
on conflict (id) do nothing;

drop policy if exists "athlete_avatars_select" on storage.objects;
drop policy if exists "athlete_avatars_write" on storage.objects;

create policy "athlete_avatars_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'athlete-avatars');

create policy "athlete_avatars_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'athlete-avatars' and (storage.foldername(objects.name))[1] = auth.uid()::text)
  with check (bucket_id = 'athlete-avatars' and (storage.foldername(objects.name))[1] = auth.uid()::text);
