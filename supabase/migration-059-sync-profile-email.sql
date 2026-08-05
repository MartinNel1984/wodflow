-- Wodflow — migration 059: keep profiles.email in sync with the real
-- login email
--
-- The athlete portal now lets an athlete change their own email via
-- supabase.auth.updateUser({ email }) — the correct path since email
-- is also the login credential (auth.users), not just profile data;
-- Supabase requires them to click a confirmation link in the new
-- inbox before auth.users.email actually changes. Without this
-- trigger, profiles.email (used to match historical placements —
-- migration-051/057 — and shown across the app) would silently drift
-- from the real login email the moment they confirm. Mirrors
-- handle_new_user's existing on-signup trigger (schema.sql), just for
-- updates instead of inserts.

create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email, updated_at = now() where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();
