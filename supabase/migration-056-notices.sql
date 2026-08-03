-- Wodflow — migration 056: event notice board
--
-- Athlete portal feature: organizers post updates/briefing-time
-- changes per event, athletes registered for that event see them.
-- No pinning/priority, no unread tracking — deliberately simple,
-- newest-first list (Martin/Tjokkie confirmed both aren't needed yet).

create table if not exists public.notices (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title           text not null,
  body            text not null,
  created_at      timestamptz not null default now()
);

create index if not exists notices_event_idx on public.notices (event_id, created_at desc);

alter table public.notices enable row level security;

drop policy if exists "notices_organizer_write" on public.notices;
create policy "notices_organizer_write" on public.notices
  for all to authenticated
  using (public.is_organizer_for(organization_id))
  with check (public.is_organizer_for(organization_id));

-- An athlete can read notices for any event they're actually
-- registered in — same "am I registered for this event" boundary the
-- rest of the portal already uses (my_registration_ids()).
drop policy if exists "notices_athlete_select" on public.notices;
create policy "notices_athlete_select" on public.notices
  for select to authenticated
  using (
    public.is_organizer_for(organization_id)
    or event_id in (
      select r.event_id
      from public.registrations r
      where r.id in (select public.my_registration_ids())
    )
  );
