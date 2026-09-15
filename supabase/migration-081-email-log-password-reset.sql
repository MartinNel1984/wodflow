-- email_log's two check constraints (migration-067) didn't anticipate a
-- send with neither a registration_id nor a ticket_id, and didn't know
-- about 'password_reset' as an email_type — so every logEmailAttempt()
-- call from sendPasswordResetEmail (see lib/email.ts) was silently
-- failing its insert, caught internally, never surfaced. The actual send
-- itself wasn't affected (env.EMAIL.send() happens first, independently),
-- only the audit trail was silently missing.
--
-- Drops the two unnamed check constraints by inspecting pg_constraint
-- rather than guessing Postgres's auto-generated names, then recreates
-- both with 'password_reset' accounted for.

do $$
declare
  c record;
begin
  for c in
    select oid, conname from pg_constraint
    where conrelid = 'public.email_log'::regclass and contype = 'c'
  loop
    if pg_get_constraintdef(c.oid) ilike '%email_type%'
      or pg_get_constraintdef(c.oid) ilike '%registration_id%is not null%'
    then
      execute format('alter table public.email_log drop constraint %I', c.conname);
    end if;
  end loop;
end $$;

alter table public.email_log add constraint email_log_email_type_check
  check (email_type in (
    'athlete_confirmation',
    'registration_organizer_notification',
    'payment_reminder',
    'ticket_confirmation',
    'ticket_organizer_notification',
    'password_reset'
  ));

alter table public.email_log add constraint email_log_has_source_or_is_reset_check
  check (registration_id is not null or ticket_id is not null or email_type = 'password_reset');
