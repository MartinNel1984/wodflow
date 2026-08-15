-- Wodflow — migration 074: organizer-postable hub news
--
-- The public homepage's "News" section was entirely auto-generated
-- from system milestones (registration open, heats released, results
-- live) — no way for an organizer to post anything themselves.
-- Tjokkie: "Heats have been released" reads as noise (it fires the
-- moment any heat row exists, published or not) and there should be
-- "a place where organiser can post News", same idea as Notices but
-- for the public hub instead of logged-in athletes. hub_news mirrors
-- hub_photos' exact RLS shape (migration-036): public read, organizer
-- write scoped to their own org.

create table if not exists public.hub_news (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  title           text not null,
  body            text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

alter table public.hub_news enable row level security;

drop policy if exists "hub_news_select" on public.hub_news;
drop policy if exists "hub_news_write" on public.hub_news;
create policy "hub_news_select" on public.hub_news
  for select to anon, authenticated using (true);
create policy "hub_news_write" on public.hub_news
  for all to authenticated using (
    public.is_organizer_for(organization_id) or public.is_platform_admin()
  ) with check (
    public.is_organizer_for(organization_id) or public.is_platform_admin()
  );
