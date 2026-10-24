-- Range accounts: one row per person holding their Range data (scores, tests, sessions, routines, settings).
-- Run once in Supabase → SQL Editor. Safe to re-run.
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- each person can only see and change their own row
drop policy if exists "user_data select own" on public.user_data;
drop policy if exists "user_data insert own" on public.user_data;
drop policy if exists "user_data update own" on public.user_data;
drop policy if exists "user_data delete own" on public.user_data;
create policy "user_data select own" on public.user_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_data insert own" on public.user_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_data update own" on public.user_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_data delete own" on public.user_data for delete to authenticated using ((select auth.uid()) = user_id);

-- let someone delete their whole account (login + data) from inside the app
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
