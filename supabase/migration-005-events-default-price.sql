-- Adds a per-event default division price. Set at event creation
-- (placeholder R500), pre-fills the "Normal price" field when the
-- organizer creates a division under that event — still editable
-- per division, this just saves re-typing the common case.
alter table public.events
  add column if not exists default_price numeric(10,2) not null default 500;
