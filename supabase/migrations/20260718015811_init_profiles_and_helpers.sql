-- Profiles + shared helpers.
--
-- Conventions used across all migrations:
--   * Every user-owned table has `user_id uuid references auth.users on delete cascade`,
--     RLS enabled, and an explicit grant to `authenticated` (the project does NOT
--     auto-expose new tables, so exposure is deliberate).
--   * RLS predicates wrap auth.uid() as `(select auth.uid())` so Postgres caches it
--     per-query instead of per-row.
--   * `service_role` (used by edge functions) is granted explicitly too.

-- ── Helper: keep an `updated_at` column current ─────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── profiles: one row per auth user ─────────────────────────────────────────
create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: select own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- ── Auto-create a profile row when a new auth user signs up ─────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
