-- Wodflow — migration 044: spectator + vendor ticket sales
--
-- See docs/plans/2026-08-01-spectator-vendor-tickets-design.md for the
-- full design. New table event_tickets — one row per *purchase* (not per
-- attendee), since we don't collect per-attendee names (flat pricing, no
-- cart, no waiver — this is a day-pass, not an athlete registration).
--
-- Two new nullable columns on events: blank price = that ticket type is
-- disabled for the event, matching the "opt-in per event" scope decision.

alter table public.events
  add column if not exists spectator_price numeric(10,2),
  add column if not exists vendor_price     numeric(10,2);

create table if not exists public.event_tickets (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete cascade,
  ticket_type         text not null check (ticket_type in ('spectator', 'vendor')),
  buyer_name          text not null,
  buyer_email         text not null,
  quantity            int not null check (quantity > 0),
  unit_price          numeric(10,2) not null,   -- snapshot at purchase time
  price_paid          numeric(10,2) not null,   -- quantity * unit_price
  payment_status      text not null default 'pending'
                        check (payment_status in ('pending', 'paid', 'refunded')),
  payfast_payment_id  text,
  paid_at             timestamptz,
  -- Token-as-credential for the public /tickets/[qr_token] page and the
  -- QR code itself — same pattern as team_invites' email_or_phone-token
  -- links. Never issued (no email sent) until payment_status = 'paid'.
  qr_token            text not null unique default encode(gen_random_bytes(16), 'hex'),
  checked_in_count    int not null default 0,
  created_at          timestamptz not null default now()
);

create index if not exists event_tickets_event_id_idx on public.event_tickets(event_id);
-- The webhook and the public ticket page both look up by qr_token /
-- payment id; id is already indexed as the primary key and doubles as
-- the payfast m_payment_id lookup key via the "ticket_<uuid>" prefix
-- convention (see app/api/webhooks/payfast/route.ts), so no separate
-- index is needed for that.

alter table public.event_tickets enable row level security;

-- Scoped to the event's organization_id via the same
-- events-join pattern used by every table since migration-026
-- (e.g. registrations_select / registrations_organizer_write).
--
-- Select: organizer or head_judge of the owning org (the checkin page
-- and any future admin ticket list need head_judge access too — unlike
-- registrations, which are organizer-write-only, ticket check-in is a
-- gate-day operation head judges also run).
-- Write: same privileged set, since confirming a scan (incrementing
-- checked_in_count) is exactly the operation the checkin page needs and
-- is restricted to organizer/head_judge by requirePrivileged() at the
-- app layer already.
--
-- Deliberately no public/anon policy: the buy flow inserts via the
-- service-role client (same pattern as /api/registrations — the buyer
-- is anonymous, not signed in) and the public /tickets/[qr_token] page
-- reads via a service-role API route keyed by the unguessable token,
-- not via RLS. There is nothing here for an anonymous session to see or
-- change directly.
drop policy if exists "event_tickets_select" on public.event_tickets;
drop policy if exists "event_tickets_write" on public.event_tickets;

create policy "event_tickets_select" on public.event_tickets
  for select to authenticated using (
    exists (
      select 1 from public.events e
      where e.id = event_tickets.event_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  );

create policy "event_tickets_write" on public.event_tickets
  for all to authenticated using (
    exists (
      select 1 from public.events e
      where e.id = event_tickets.event_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  ) with check (
    exists (
      select 1 from public.events e
      where e.id = event_tickets.event_id
        and (public.is_privileged_for(e.organization_id) or public.is_platform_admin())
    )
  );

-- ------------------------------------------------------------
-- Atomic gate check-in. A plain `.update()` from PostgREST can't
-- express `checked_in_count = checked_in_count + 1` as a single
-- conditional statement, and a read-then-write from the client would
-- race two concurrent scans of the same ticket (e.g. two gate staff
-- scanning the same group's ticket within the same second) past the
-- "already fully used" check before either commits. A single UPDATE
-- statement with the guard in its WHERE clause is atomic at the row
-- level, so this function does the whole increment-if-room-left check
-- server-side in one statement.
--
-- security definer (like set_user_pin/verify_user_pin) so it can run
-- the update regardless of RLS, but it re-implements the same
-- is_privileged_for(org) authorization check event_tickets_write does,
-- rather than skipping it — a security definer function is exactly the
-- kind of thing that would otherwise quietly become a privilege-
-- escalation hole (see migration-035's profiles bug).
-- ------------------------------------------------------------
create or replace function public.check_in_ticket(p_ticket_id uuid)
returns table (id uuid, checked_in_count int, quantity int, already_full boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
begin
  select e.organization_id into v_org_id
  from public.event_tickets t
  join public.events e on e.id = t.event_id
  where t.id = p_ticket_id;

  if v_org_id is null then
    raise exception 'Ticket not found';
  end if;

  if not (public.is_privileged_for(v_org_id) or public.is_platform_admin()) then
    raise exception 'Not authorised';
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
