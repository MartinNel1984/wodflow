-- migration-026 rewrote every write policy that used the old global
-- is_organizer() helper to be org-scoped via is_organizer_for(), but
-- missed workouts/workout_movements (added in migration-008, before
-- multi-tenancy existed). Left as-is, any organizer at any org could
-- create/update/delete another org's workouts — including
-- copyWorkoutsFromDivision, which reads a division_id supplied by the
-- client with no ownership check of its own.

drop policy if exists "workouts_write" on public.workouts;
create policy "workouts_write" on public.workouts
  for all to authenticated using (
    exists (
      select 1 from public.divisions d
      join public.events e on e.id = d.event_id
      where d.id = workouts.division_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  ) with check (
    exists (
      select 1 from public.divisions d
      join public.events e on e.id = d.event_id
      where d.id = workouts.division_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  );

drop policy if exists "workout_movements_write" on public.workout_movements;
create policy "workout_movements_write" on public.workout_movements
  for all to authenticated using (
    exists (
      select 1 from public.workouts w
      join public.divisions d on d.id = w.division_id
      join public.events e on e.id = d.event_id
      where w.id = workout_movements.workout_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  ) with check (
    exists (
      select 1 from public.workouts w
      join public.divisions d on d.id = w.division_id
      join public.events e on e.id = d.event_id
      where w.id = workout_movements.workout_id
        and (public.is_organizer_for(e.organization_id) or public.is_platform_admin())
    )
  );
