-- Wodflow — migration 047: weekend pass ticket type
--
-- Adds a second spectator ticket tier. The existing `spectator` ticket_type
-- value (migration-044) keeps its DB name to avoid touching any
-- already-sold rows/QR tokens — it now means "day pass" and is labelled
-- that way in the UI. `weekend_pass` is the new all-days tier, with its
-- own opt-in price/capacity columns following the same "blank = disabled"
-- convention as spectator_price (migration-044) and spectator_capacity
-- (migration-046).

alter table public.event_tickets drop constraint if exists event_tickets_ticket_type_check;
alter table public.event_tickets
  add constraint event_tickets_ticket_type_check
  check (ticket_type in ('spectator', 'weekend_pass'));

alter table public.events
  add column if not exists weekend_pass_price numeric(10,2),
  add column if not exists weekend_pass_capacity int check (weekend_pass_capacity > 0);

-- enforce_spectator_capacity (migration-046) summed quantity across the
-- whole event regardless of ticket_type, which was fine when only one
-- type existed. Now that day pass and weekend pass are sold as separate
-- inventories with separate caps, both the capacity lookup and the sold
-- count must be scoped to new.ticket_type.
create or replace function public.enforce_spectator_capacity()
returns trigger
language plpgsql
as $$
declare
  cap        int;
  per_order  int;
  sold       int;
begin
  select
    case new.ticket_type
      when 'weekend_pass' then weekend_pass_capacity
      else spectator_capacity
    end,
    max_tickets_per_order
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

  select coalesce(sum(quantity), 0) into sold
    from public.event_tickets
    where event_id = new.event_id
      and ticket_type = new.ticket_type
      and payment_status <> 'refunded';

  if sold + new.quantity > cap then
    raise exception 'Only % ticket(s) left', greatest(cap - sold, 0)
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;
