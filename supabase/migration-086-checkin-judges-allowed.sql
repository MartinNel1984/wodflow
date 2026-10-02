-- Wodflow — migration 086: let plain judges run gate check-in
--
-- Context (Rumble in Randburg, Tjokkie / Melissa): extra staff on the
-- gate just need to scan tickets, but the scanner was gated to
-- organizer/head_judge (migration-044 + migration-083 RPCs, plus the
-- event_tickets_select RLS). Promoting those staff to head_judge is
-- overkill — it also unlocks score corrections and heat lock/unlock
-- across the event. Open the scanner path (lookup + confirm) to plain
-- judges in the same org, without widening anything else.
--
-- Scope:
--   - new helper public.is_checkin_authorized_for(org_id)
--     — organizer OR head_judge OR judge in that active org
--   - extra SELECT RLS on event_tickets and ticket_daily_checkins so
--     a plain judge can read the rows the scanner page needs
--   - loosen check_in_ticket()'s inner guard to the new helper
--
-- Everything else (writes to event_tickets outside the RPC, scores,
-- heats, etc.) stays organizer/head_judge only.

create or replace function public.is_checkin_authorized_for(org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles p
    join public.organizations o on o.id = p.organization_id
    where p.id = auth.uid()
      and p.role in ('organizer', 'head_judge', 'judge')
      and p.organization_id = org_id
      and o.status = 'active'
  );
$$;

grant execute on function public.is_checkin_authorized_for(uuid) to authenticated;

-- Second SELECT policy — additive to event_tickets_select, which stays
-- in place for organizer/head_judge (they also need write access, which
-- the existing event_tickets_write policy continues to gate).
drop policy if exists "event_tickets_select_checkin" on public.event_tickets;
create policy "event_tickets_select_checkin" on public.event_tickets
  for select to authenticated using (
    exists (
      select 1 from public.events e
      where e.id = event_tickets.event_id
        and public.is_checkin_authorized_for(e.organization_id)
    )
  );

drop policy if exists "ticket_daily_checkins_select_checkin" on public.ticket_daily_checkins;
create policy "ticket_daily_checkins_select_checkin" on public.ticket_daily_checkins
  for select to authenticated using (
    exists (
      select 1 from public.event_tickets t
      join public.events e on e.id = t.event_id
      where t.id = ticket_daily_checkins.ticket_id
        and public.is_checkin_authorized_for(e.organization_id)
    )
  );

-- Loosen check_in_ticket()'s inner guard. Body is otherwise identical
-- to migration-083's version — only the one authorization line changes.
create or replace function public.check_in_ticket(p_ticket_id uuid)
returns table (id uuid, checked_in_count int, quantity int, already_full boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_type   text;
  v_today  date := (now() at time zone 'Africa/Johannesburg')::date;
begin
  select e.organization_id, t.ticket_type into v_org_id, v_type
  from public.event_tickets t
  join public.events e on e.id = t.event_id
  where t.id = p_ticket_id;

  if v_org_id is null then
    raise exception 'Ticket not found';
  end if;

  if not (public.is_checkin_authorized_for(v_org_id) or public.is_platform_admin()) then
    raise exception 'Not authorised';
  end if;

  if v_type = 'weekend_pass' then
    insert into public.ticket_daily_checkins (ticket_id, checkin_date)
    values (p_ticket_id, v_today)
    on conflict do nothing;

    return query
    update public.ticket_daily_checkins d
    set checked_in_count = d.checked_in_count + 1
    from public.event_tickets t
    where d.ticket_id = p_ticket_id
      and d.checkin_date = v_today
      and t.id = d.ticket_id
      and d.checked_in_count < t.quantity
    returning t.id, d.checked_in_count, t.quantity, false;

    if found then
      update public.event_tickets t
      set checked_in_count = t.checked_in_count + 1
      where t.id = p_ticket_id;
      return;
    end if;

    return query
    select t.id, coalesce(d.checked_in_count, 0), t.quantity, true
    from public.event_tickets t
    left join public.ticket_daily_checkins d
      on d.ticket_id = t.id and d.checkin_date = v_today
    where t.id = p_ticket_id;
    return;
  end if;

  return query
  update public.event_tickets t
  set checked_in_count = t.checked_in_count + 1
  where t.id = p_ticket_id and t.checked_in_count < t.quantity
  returning t.id, t.checked_in_count, t.quantity, false;

  if found then
    return;
  end if;

  return query
  select t.id, t.checked_in_count, t.quantity, true
  from public.event_tickets t
  where t.id = p_ticket_id;
end;
$$;

grant execute on function public.check_in_ticket(uuid) to authenticated;
