-- ============================================================
-- Wodflow — Judge PIN login
-- Run AFTER schema.sql. Safe to re-run (idempotent).
-- Ported from tcrpv-portal's staff-pin-login.sql — same bcrypt +
-- attempt-lockout pattern, scoped to profiles.role = 'judge'.
-- ============================================================

create extension if not exists pgcrypto;

-- pin_hash / pin_set / pin_attempts / pin_locked_until columns
-- already exist on public.profiles from schema.sql.

-- ------------------------------------------------------------
-- 1. RPC: set a profile's PIN (bcrypt-hashed, never stored raw).
--    Callable by: an organizer, a user setting their OWN pin,
--    or the service role during seeding (auth.uid() is null).
-- ------------------------------------------------------------
create or replace function public.set_user_pin(p_profile uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  if not (public.is_organizer() or auth.uid() = p_profile or auth.uid() is null) then
    raise exception 'Not authorised to set this PIN';
  end if;

  update public.profiles
  set pin_hash         = crypt(p_pin, gen_salt('bf')),
      pin_set          = true,
      pin_attempts     = 0,
      pin_locked_until = null,
      updated_at       = now()
  where id = p_profile;
end;
$$;

revoke execute on function public.set_user_pin(uuid, text) from public, anon;
grant  execute on function public.set_user_pin(uuid, text) to authenticated, service_role;

-- ------------------------------------------------------------
-- 2. RPC: verify a PIN with attempt-counting + lockout.
--    Used ONLY by the service-role login route.
--    Returns jsonb: { status, attempts_left, locked_until }
--      status = 'ok' | 'bad' | 'locked' | 'no_pin'
-- ------------------------------------------------------------
create or replace function public.verify_user_pin(p_profile uuid, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  rec        record;
  max_tries  int := 5;
  lock_mins  int := 15;
begin
  select pin_hash, pin_attempts, pin_locked_until
    into rec
  from public.profiles
  where id = p_profile;

  if not found or rec.pin_hash is null then
    return jsonb_build_object('status', 'no_pin');
  end if;

  if rec.pin_locked_until is not null and rec.pin_locked_until > now() then
    return jsonb_build_object('status', 'locked', 'locked_until', rec.pin_locked_until);
  end if;

  if crypt(p_pin, rec.pin_hash) = rec.pin_hash then
    update public.profiles
    set pin_attempts = 0, pin_locked_until = null
    where id = p_profile;
    return jsonb_build_object('status', 'ok');
  end if;

  -- wrong PIN — count the attempt, lock out after max_tries
  if rec.pin_attempts + 1 >= max_tries then
    update public.profiles
    set pin_attempts = 0,
        pin_locked_until = now() + make_interval(mins => lock_mins)
    where id = p_profile;
    return jsonb_build_object('status', 'locked',
                              'locked_until', now() + make_interval(mins => lock_mins));
  else
    update public.profiles
    set pin_attempts = rec.pin_attempts + 1
    where id = p_profile;
    return jsonb_build_object('status', 'bad',
                              'attempts_left', max_tries - (rec.pin_attempts + 1));
  end if;
end;
$$;

revoke execute on function public.verify_user_pin(uuid, text) from public, anon, authenticated;
grant  execute on function public.verify_user_pin(uuid, text) to service_role;
