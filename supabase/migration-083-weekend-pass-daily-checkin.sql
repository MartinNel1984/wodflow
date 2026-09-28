-- Wodflow — migration 083: weekend passes check in once per day
--
-- check_in_ticket() (migration-044) gates entry on a single lifetime
-- checked_in_count vs quantity. That's right for a day pass (one scan
-- uses it up for good) but wrong for a weekend pass (migration-047): a
-- weekend pass scanned on day 1 reaches checked_in_count = quantity and
-- the gate then reports "already fully used" on day 2 and 3.
--
-- Weekend passes now gate on a per-day count instead, kept in a new
-- table with one row per ticket per calendar day. The day is computed in
-- Africa/Johannesburg time so a scan just after midnight UTC (02:00
-- local) isn't counted against the wrong day. Day passes keep the
-- original lifetime gate unchanged.
--
-- event_tickets.checked_in_count is still incremented for weekend passes
-- as a running total of entries across the event (it can exceed
-- quantity for them); it just no longer gates entry.

create table if not exists public.ticket_daily_checkins (
  ticket_id         uuid not null references public.event_tickets(id) on delete cascade,
  checkin_date      date not null,
  checked_in_count  int not null default 0 check (checked_in_count >= 0),
  primary key (ticket_id, checkin_date)
);

alter table public.ticket_daily_checkins enable row level security;

-- Read access mirrors event_tickets_select. No write policy: rows are
-- only ever written by check_in_ticket() below (security definer), so
-- the atomic guard can't be bypassed with a direct update.
drop policy if exists "ticket_daily_checkins_select" on public.ticket_daily_checkins;
create policy "ticket_daily_checkins_select" on public.ticket_daily_checkins
  for select to authenticated using (
    exists (
      select 1 from public.event_tickets t
      join public.events e on e.id = t.event_id
      where t.id = ticket_daily_checkins.ticket_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  );

-- Supabase's default privileges grant ALL to anon/authenticated on new
-- tables; lock it down explicitly (see migration-076 for what happens
-- when this is left to defaults).
revoke all on public.ticket_daily_checkins from anon, authenticated;
grant select on public.ticket_daily_checkins to authenticated;

-- ------------------------------------------------------------
-- The count that gates entry right now: today's count for a weekend
-- pass, the lifetime count for a day pass. Used by the gate lookup and
-- the public ticket page so both show the same number check_in_ticket()
-- gates on. security invoker, so RLS applies to gate staff; the public
-- ticket route calls it with the service role.
-- ------------------------------------------------------------
create or replace function public.ticket_checked_in_now(p_ticket_id uuid)
returns int
language sql stable security invoker set search_path = public as $$
  select case
    when t.ticket_type = 'weekend_pass' then coalesce((
      select d.checked_in_count
      from public.ticket_daily_checkins d
      where d.ticket_id = t.id
        and d.checkin_date = (now() at time zone 'Africa/Johannesburg')::date
    ), 0)
    else t.checked_in_count
  end
  from public.event_tickets t
  where t.id = p_ticket_id;
$$;

revoke all on function public.ticket_checked_in_now(uuid) from public, anon;
grant execute on function public.ticket_checked_in_now(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- Same signature and return shape as migration-044, so callers don't
-- change. For weekend passes checked_in_count in the result is today's
-- count, and already_full means "already used today".
-- ------------------------------------------------------------
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

  if not (public.is_privileged_for(v_org_id) or public.is_platform_admin()) then
    raise exception 'Not authorised';
  end if;

  if v_type = 'weekend_pass' then
    insert into public.ticket_daily_checkins (ticket_id, checkin_date)
    values (p_ticket_id, v_today)
    on conflict do nothing;

    -- Single UPDATE with the guard in its WHERE clause, same as the day
    -- pass path: two concurrent scans at the limit can't both succeed.
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
