-- Wodflow — migration 064: box-wide notices reach every athlete account
--
-- migration-063 scoped box-wide notices to athletes with at least one
-- registration under the org — too narrow (Martin, 2026-08-12): an
-- athlete account on the portal should count as "in the box" even
-- before their first registration.
--
-- Athlete profiles don't carry organization_id (only organizer/judge
-- profiles do — see migration-026), so there's no real signal tying
-- an athlete account to one specific org. Right now ATG is the only
-- organization in the database, so "every athlete profile" and
-- "every Rumble Series athlete" are the same set.
--
-- ⚠️ TODO before onboarding a second box/organizer: this makes
-- box-wide notices visible to every athlete profile platform-wide,
-- not scoped per org. Needs a real "which portal did this athlete
-- sign up on" signal (e.g. capture organization_id at athlete signup)
-- before that's safe with 2+ orgs.

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
      and exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.role = 'athlete'
      )
    )
  );
