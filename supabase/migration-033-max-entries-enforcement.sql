-- The app-level max_entries check in app/api/registrations/route.ts is a
-- plain count-then-insert with no locking: two registrations submitted
-- concurrently for the last open slot can both read the same count and
-- both pass, overselling the division. Enforce the cap at the DB level
-- instead, where a row lock on the division serializes concurrent
-- inserts for the same division_id.

create or replace function public.enforce_division_max_entries()
returns trigger
language plpgsql
as $$
declare
  cap int;
  current_count int;
begin
  select max_entries into cap from public.divisions where id = new.division_id for update;
  if cap is null then
    return new;
  end if;

  select count(*) into current_count
    from public.registrations
    where division_id = new.division_id
      and payment_status <> 'refunded';

  if current_count >= cap then
    raise exception 'Division is full (max % entries)', cap
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_division_max_entries on public.registrations;
create trigger enforce_division_max_entries
  before insert on public.registrations
  for each row execute function public.enforce_division_max_entries();
