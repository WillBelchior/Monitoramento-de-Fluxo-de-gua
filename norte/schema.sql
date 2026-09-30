-- NORTE | banco inicial
-- Execute no SQL Editor do projeto Supabase dedicado ao app.

create extension if not exists pgcrypto;

create table if not exists public.priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  notes text not null default '',
  horizon text not null check (horizon in ('day','week','month','semester')),
  status text not null default 'todo' check (status in ('backlog','todo','doing','done')),
  priority smallint not null default 2 check (priority between 1 and 4),
  effort smallint not null default 2 check (effort between 1 and 3),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.priorities enable row level security;

grant select, insert, update, delete on table public.priorities to authenticated;

drop policy if exists "read own priorities" on public.priorities;
create policy "read own priorities"
on public.priorities for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "insert own priorities" on public.priorities;
create policy "insert own priorities"
on public.priorities for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "update own priorities" on public.priorities;
create policy "update own priorities"
on public.priorities for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "delete own priorities" on public.priorities;
create policy "delete own priorities"
on public.priorities for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Habilita a tabela para eventos postgres_changes do Realtime.
alter publication supabase_realtime add table public.priorities;

create index if not exists priorities_user_status_idx on public.priorities(user_id, status);
create index if not exists priorities_user_horizon_idx on public.priorities(user_id, horizon);
create index if not exists priorities_due_date_idx on public.priorities(due_date);
