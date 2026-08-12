-- Wodflow — migration 063: org-wide notices
--
-- Athlete portal feature request (Tjokkie, 2026-08-12): let organizers
-- post a notice to everyone who's ever registered with the box, not
-- just athletes registered for one specific event (new deals,
-- specials, off-season announcements). event_id null = box-wide.

alter table public.notices alter column event_id drop not null;

create index if not exists notices_org_idx on public.notices (organization_id, created_at desc);

-- An athlete can read an org-wide notice (event_id is null) if they've
-- ever registered for ANY event under that organization — same "have
-- I ever been part of this box" boundary, just not pinned to one event.
drop policy if exists "notices_athlete_select" on public.notices;
create policy "notices_athlete_select" on public.notices
  for select to authenticated
  using (
    public.is_organizer_for(organization_id)
    or (
      event_id is not null
      and event_id in (
        select r.event_id
        from public.registrations r
        where r.id in (select public.my_registration_ids())
      )
    )
    or (
      event_id is null
      and organization_id in (
        select e.organization_id
        from public.registrations r
        join public.events e on e.id = r.event_id
        where r.id in (select public.my_registration_ids())
      )
    )
  );
