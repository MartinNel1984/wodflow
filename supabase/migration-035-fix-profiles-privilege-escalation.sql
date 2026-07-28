-- ============================================================
-- Wodflow — migration 035: close profiles privilege-escalation gap
--
-- Full-codebase audit (2026-07-28) found that migration-026's
-- multi-tenancy rewrite never touched two pre-existing policies on
-- profiles, both defined before organizations existed:
--
-- 1. "profiles_update_self" (rls-policies.sql) restricts *which row*
--    (id = auth.uid()) but not *which columns*. Any signed-up athlete
--    can PATCH their own row via PostgREST and set
--    role = 'platform_admin' (or 'organizer' with any organization_id)
--    — full platform takeover from a free signup, no UI needed.
--
-- 2. "profiles_organizer_write" (migration-002) still uses the bare,
--    pre-multi-tenancy is_organizer() (role-only, no org check) with
--    `for all`. Because Postgres OR's multiple permissive policies for
--    the same command, this silently reopens cross-tenant SELECT/
--    UPDATE/DELETE on every org's full profiles table (PII + pin_hash)
--    that migration-026/027 believed they'd closed. Checked app code:
--    every real cross-profile write (creating a judge, accepting an
--    org invite) already goes through the service-role client with its
--    own requireOrganizer()/invite check — no legitimate flow depends
--    on this RLS policy, so it's dropped outright rather than rescoped.
--
-- Also fixes judge-pin-login.sql's set_user_pin(), which gated
-- "organizer can set someone else's PIN" on the same bare
-- is_organizer() — letting any org's organizer set a PIN on another
-- org's judge/head_judge/organizer profile and log in as them.
--
-- Run in the Supabase SQL Editor in one go. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Drop the dead, dangerous cross-tenant write policy.
-- ------------------------------------------------------------
drop policy if exists "profiles_organizer_write" on public.profiles;

-- ------------------------------------------------------------
-- 2. Column-lock self-service updates. RLS restricts rows; only a
--    Postgres column-level grant can restrict which columns a row
--    policy's UPDATE is allowed to touch. Self-service can rename
--    yourself, fix your email/phone/id_number — never your role,
--    organization_id, or PIN fields.
-- ------------------------------------------------------------
revoke update on public.profiles from authenticated;
grant update (full_name, email, phone, id_number, updated_at)
  on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 3. set_user_pin — scope "organizer sets someone else's PIN" to the
--    target profile's own org, not any organizer anywhere.
-- ------------------------------------------------------------
create or replace function public.set_user_pin(p_profile uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  target_org uuid;
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  select organization_id into target_org from public.profiles where id = p_profile;

  if not (
    auth.uid() = p_profile
    or auth.uid() is null
    or public.is_platform_admin()
    or (target_org is not null and public.is_organizer_for(target_org))
  ) then
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
