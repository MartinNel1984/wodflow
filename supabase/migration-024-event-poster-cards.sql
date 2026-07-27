-- ============================================================
-- Wodflow — migration 024: event description + poster image
--
-- Organizer feedback (Tjokkie, ATG Fitness) asked for richer event
-- cards — a poster image and a real description, not just name/date/
-- venue. Adds the two columns plus a public Storage bucket for the
-- poster upload (Wodflow's first real file-upload flow — organizers
-- previously only ever pasted a logo URL for brand kits).
-- ============================================================

alter table public.events
  add column if not exists description text,
  add column if not exists poster_url  text;

-- Public bucket: posters are meant to be seen by anyone visiting the
-- homepage/register page, same visibility level as the events they
-- belong to.
insert into storage.buckets (id, name, public)
values ('event-posters', 'event-posters', true)
on conflict (id) do nothing;

drop policy if exists "event_posters_select" on storage.objects;
drop policy if exists "event_posters_write" on storage.objects;

create policy "event_posters_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'event-posters');

create policy "event_posters_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'event-posters' and public.is_organizer())
  with check (bucket_id = 'event-posters' and public.is_organizer());
