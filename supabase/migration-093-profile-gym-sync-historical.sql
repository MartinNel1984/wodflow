-- Wodflow — migration 093: propagate profile gym changes to historical results
--
-- Tjokkie, 2026-10-05: "should an athlete update their gym name it should
-- update the gym name across all historic events we have on record."
-- Current state (migration-082 backfill plus row-level edits from the
-- Historical Results admin page) treats historical_results.gym_name as
-- source of truth for the Community Cup roll-up. Add a trigger so that
-- whenever profiles.gym_name moves, every historical_results row for the
-- same email is updated to match — so an athlete editing their profile,
-- an admin editing an athlete's gym, or a bulk gyms-table rename all
-- flow through to prior finishes automatically.
--
-- Matches on lower(athlete_email) because that's how the Community Cup
-- identity hash is computed (md5(lower(email))) and how migration-082's
-- backfill matched.

create or replace function public.sync_historical_gym_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.gym_name, '') is distinct from coalesce(old.gym_name, '')
     and new.email is not null
     and btrim(new.email) <> '' then
    update public.historical_results
       set gym_name = new.gym_name
     where lower(athlete_email) = lower(new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_historical_gym_from_profile on public.profiles;
create trigger trg_sync_historical_gym_from_profile
  after update of gym_name on public.profiles
  for each row
  execute function public.sync_historical_gym_from_profile();
