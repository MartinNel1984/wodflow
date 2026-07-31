-- Wodflow — migration 043: remove Yoco, PayFast-only
--
-- Yoco was added as a second payment provider alongside PayFast
-- (migration-021) but has never actually been used — zero registrations
-- have ever carried a yoco_checkout_id or paid_via = 'yoco'. Wodflow/ATC
-- only uses PayFast, so removing the dead code path and its columns
-- rather than carrying an unused, untested integration and an
-- events.payment_provider selector that just adds a confusing choice
-- with only one real answer.

alter table public.registrations
  drop column if exists yoco_checkout_id;

alter table public.events
  drop column if exists payment_provider;
