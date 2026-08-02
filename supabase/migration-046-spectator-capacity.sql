-- Wodflow — migration 046: spectator ticket capacity
--
-- Closes a real gap in migration-044: divisions have max_entries with a
-- DB-level trigger, but spectator tickets had no capacity limit at all —
-- a fixed-capacity venue could be oversold without limit.
--
-- Two separate limits, doing different jobs:
--   * events.spectator_capacity — total passes for the venue (null =
--     unlimited, matching the "opt-in per event" convention already used
--     for spectator_price).
--   * events.max_tickets_per_order — guards against a buyer typo (100
--     instead of 10) turning into a five-figure PayFast checkout.
--     Defaults to 20.
--
-- The trigger, not the app, is the source of truth. app/api/tickets does
-- a friendly pre-check, but that check is not a lock: two concurrent
-- purchases for the last few seats can both pass it before either
-- commits. Same lesson already learned on registrations
-- (migration-033) — so this mirrors that pattern exactly, including the
-- SELECT ... FOR UPDATE row lock on the parent events row to serialize
-- concurrent inserts for the same event.
--
-- Note this SUMS quantity rather than counting rows: one ticket row can
-- be a purchase of 6 passes, so count(*) would wildly under-count.

alter table public.events
  add column if not exists spectator_capacity    int check (spectator_capacity > 0),
  add column if not exists max_tickets_per_order int not null default 20
    check (max_tickets_per_order > 0);

create or replace function public.enforce_spectator_capacity()
returns trigger
language plpgsql
as $$
declare
  cap        int;
  per_order  int;
  sold       int;
begin
  select spectator_capacity, max_tickets_per_order
    into cap, per_order
    from public.events
    where id = new.event_id
    for update;

  if per_order is not null and new.quantity > per_order then
    raise exception 'Maximum % tickets per order', per_order
      using errcode = 'P0001';
  end if;

  if cap is null then
    return new;
  end if;

  -- Refunded purchases release their seats; pending and paid both hold
  -- them (a pending checkout is mid-payment, not a free seat).
  select coalesce(sum(quantity), 0) into sold
    from public.event_tickets
    where event_id = new.event_id
      and payment_status <> 'refunded';

  if sold + new.quantity > cap then
    raise exception 'Only % spectator ticket(s) left', greatest(cap - sold, 0)
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_spectator_capacity on public.event_tickets;
create trigger enforce_spectator_capacity
  before insert on public.event_tickets
  for each row execute function public.enforce_spectator_capacity();
