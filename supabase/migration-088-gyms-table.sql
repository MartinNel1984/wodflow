-- ============================================================
-- Wodflow — migration 088: gyms master list
--
-- Tjokkie asked for Gym to become a required dropdown so leaderboard
-- counts aren't fragmented by typos (ATG, ATG Randburg, ATG - Randburg,
-- ATG Fitness all meant the same gym). This migration:
--
--   1. Creates a `gyms` table (the master list).
--   2. Seeds the 26 canonical gyms from Tjokkie's Rumble master-list CSV
--      (/Users/marthinusnel/Downloads/rumble_in_randburg_gym_master_list.csv),
--      all approved.
--   3. Cleans up existing free-text gym_name values on profiles and
--      registration_athletes using the variations mapping from the CSV.
--   4. Adds any remaining non-blank distinct gym_name values as *pending*
--      gym rows so they show up in the admin review list.
--
-- Columns `profiles.gym_name` and `registration_athletes.gym_name` stay
-- as free-text to minimise disruption — the gyms table is the source of
-- truth for the dropdown, and writes resolve to canonical names before
-- hitting those columns.
--
-- Safe to re-run.
-- ============================================================

-- 1. table
create table if not exists public.gyms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  approved   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Case-insensitive unique index so "atg crossfit randburg" and
-- "ATG CrossFit Randburg" can't both exist as separate rows.
create unique index if not exists gyms_name_ci_uq on public.gyms (lower(btrim(name)));

alter table public.gyms enable row level security;

-- Anyone (incl. anon signup flow) can read the approved list.
drop policy if exists "gyms_select_approved" on public.gyms;
create policy "gyms_select_approved" on public.gyms
  for select to anon, authenticated using (approved = true or public.is_organizer());

-- Any authenticated athlete can propose a new gym (goes in pending).
drop policy if exists "gyms_insert_pending" on public.gyms;
create policy "gyms_insert_pending" on public.gyms
  for insert to authenticated with check (approved = false);

-- Only organisers can approve, rename, or delete.
drop policy if exists "gyms_organizer_write" on public.gyms;
create policy "gyms_organizer_write" on public.gyms
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

grant select on public.gyms to anon, authenticated;
grant insert (name) on public.gyms to authenticated;

-- 2. seed canonical list (idempotent)
insert into public.gyms (name, approved) values
  ('ATG CrossFit Craighall', true),
  ('ATG CrossFit Randburg', true),
  ('ATG CrossFit Bryanston', true),
  ('ATG CrossFit Norwood', true),
  ('CrossFit BST', true),
  ('CrossFit Noise 1540', true),
  ('CrossFit PFC', true),
  ('CrossFit PBM', true),
  ('CrossFit Proform', true),
  ('CrossFit Rising Oak', true),
  ('CrossFit Uncontained', true),
  ('CrossFit Urban Shack Randburg', true),
  ('Epic Athletic', true),
  ('Hybrid Factory Fourways', true),
  ('Ivory Functional Fitness', true),
  ('MK Two Rivers', true),
  ('PFL CrossFit', true),
  ('Plotbox CrossFit', true),
  ('Pure Fitness', true),
  ('REF CrossFit Jozi', true),
  ('RTF CrossFit', true),
  ('Rude Fitness', true),
  ('Tenaciti', true),
  ('TogGun Fitness South Wing', true),
  ('Waya Fitness', true),
  ('Willow Way Fitness Lynnwood', true)
on conflict (lower(btrim(name))) do update set approved = true;

-- 3. canonicalise existing gym_name values via variations table
with variations(variant, canonical) as (
  values
    ('atg craighall',                     'ATG CrossFit Craighall'),
    ('atg',                                'ATG CrossFit Randburg'),
    ('atg randburg',                       'ATG CrossFit Randburg'),
    ('atg - randburg',                     'ATG CrossFit Randburg'),
    ('atg fitness',                        'ATG CrossFit Randburg'),
    ('blood sweat and tears - bst',        'CrossFit BST'),
    ('bst',                                'CrossFit BST'),
    ('bst crossfit',                       'CrossFit BST'),
    ('crossfit noise 1540',                'CrossFit Noise 1540'),
    ('crossfit pfc',                       'CrossFit PFC'),
    ('crossfit pbm',                       'CrossFit PBM'),
    ('crossfit proform',                   'CrossFit Proform'),
    ('crossfit rising oak',                'CrossFit Rising Oak'),
    ('crossfit uncontained',               'CrossFit Uncontained'),
    ('crossfit urban shack randburg',      'CrossFit Urban Shack Randburg'),
    ('epic athletic',                      'Epic Athletic'),
    ('hybrid factory fourways',            'Hybrid Factory Fourways'),
    ('ivory functional fitness',           'Ivory Functional Fitness'),
    ('mk two rivers',                      'MK Two Rivers'),
    ('mk2r fitness',                       'MK Two Rivers'),
    ('pfl crossfit',                       'PFL CrossFit'),
    ('plotbox crossfit',                   'Plotbox CrossFit'),
    ('pure fitness',                       'Pure Fitness'),
    ('purefitness',                        'Pure Fitness'),
    ('ref crossfit jozi',                  'REF CrossFit Jozi'),
    ('rtf crossfit',                       'RTF CrossFit'),
    ('rtf crossfit krugersdorp',           'RTF CrossFit'),
    ('rude fitness',                       'Rude Fitness'),
    ('tenaciti',                           'Tenaciti'),
    ('toggun fitness south wing',          'TogGun Fitness South Wing'),
    ('waya fitness',                       'Waya Fitness'),
    ('waya',                               'Waya Fitness'),
    ('willow way fitness lynnwood',        'Willow Way Fitness Lynnwood')
)
update public.profiles p
   set gym_name = v.canonical
  from variations v
 where lower(btrim(p.gym_name)) = v.variant
   and p.gym_name is distinct from v.canonical;

with variations(variant, canonical) as (
  values
    ('atg craighall',                     'ATG CrossFit Craighall'),
    ('atg',                                'ATG CrossFit Randburg'),
    ('atg randburg',                       'ATG CrossFit Randburg'),
    ('atg - randburg',                     'ATG CrossFit Randburg'),
    ('atg fitness',                        'ATG CrossFit Randburg'),
    ('blood sweat and tears - bst',        'CrossFit BST'),
    ('bst',                                'CrossFit BST'),
    ('bst crossfit',                       'CrossFit BST'),
    ('crossfit noise 1540',                'CrossFit Noise 1540'),
    ('crossfit pfc',                       'CrossFit PFC'),
    ('crossfit pbm',                       'CrossFit PBM'),
    ('crossfit proform',                   'CrossFit Proform'),
    ('crossfit rising oak',                'CrossFit Rising Oak'),
    ('crossfit uncontained',               'CrossFit Uncontained'),
    ('crossfit urban shack randburg',      'CrossFit Urban Shack Randburg'),
    ('epic athletic',                      'Epic Athletic'),
    ('hybrid factory fourways',            'Hybrid Factory Fourways'),
    ('ivory functional fitness',           'Ivory Functional Fitness'),
    ('mk two rivers',                      'MK Two Rivers'),
    ('mk2r fitness',                       'MK Two Rivers'),
    ('pfl crossfit',                       'PFL CrossFit'),
    ('plotbox crossfit',                   'Plotbox CrossFit'),
    ('pure fitness',                       'Pure Fitness'),
    ('purefitness',                        'Pure Fitness'),
    ('ref crossfit jozi',                  'REF CrossFit Jozi'),
    ('rtf crossfit',                       'RTF CrossFit'),
    ('rtf crossfit krugersdorp',           'RTF CrossFit'),
    ('rude fitness',                       'Rude Fitness'),
    ('tenaciti',                           'Tenaciti'),
    ('toggun fitness south wing',          'TogGun Fitness South Wing'),
    ('waya fitness',                       'Waya Fitness'),
    ('waya',                               'Waya Fitness'),
    ('willow way fitness lynnwood',        'Willow Way Fitness Lynnwood')
)
update public.registration_athletes ra
   set gym_name = v.canonical
  from variations v
 where lower(btrim(ra.gym_name)) = v.variant
   and ra.gym_name is distinct from v.canonical;

-- 4. surface any remaining unmatched gym_name values as pending gyms so
--    the organiser can approve/rename them in /gyms.
insert into public.gyms (name, approved)
select distinct btrim(p.gym_name), false
  from public.profiles p
 where p.gym_name is not null
   and btrim(p.gym_name) <> ''
   and lower(btrim(p.gym_name)) not in (select lower(btrim(name)) from public.gyms)
on conflict (lower(btrim(name))) do nothing;

insert into public.gyms (name, approved)
select distinct btrim(ra.gym_name), false
  from public.registration_athletes ra
 where ra.gym_name is not null
   and btrim(ra.gym_name) <> ''
   and lower(btrim(ra.gym_name)) not in (select lower(btrim(name)) from public.gyms)
on conflict (lower(btrim(name))) do nothing;
