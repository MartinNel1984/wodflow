-- Optional cap on how many teams/athletes can register in a division.
-- Null = unlimited (existing divisions keep working unchanged).
alter table public.divisions
  add column if not exists max_entries int check (max_entries > 0);
