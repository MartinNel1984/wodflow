-- Adds PayFast as a selectable payment provider alongside Yoco.
-- Run in Supabase SQL Editor.

alter table public.events
  add column if not exists payment_provider text not null default 'yoco'
    check (payment_provider in ('yoco', 'payfast'));

alter table public.registrations
  add column if not exists payfast_payment_id text;
