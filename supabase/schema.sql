-- Food, Symptom & Cycle Tracker — database schema
-- Paste this whole file into the Supabase SQL Editor and click "Run".
-- Safe to re-run: uses "if not exists" everywhere.

create extension if not exists pgcrypto;

-- One row per logged day. "foods" is a JSON list of {meal, text, t} entries,
-- same shape the original artifact used.
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date date not null,
  foods jsonb not null default '[]'::jsonb,
  energy smallint,
  fog smallint,
  migraine text,
  sleep numeric,
  movement text,
  notes text,
  snack2 text,
  snack5 text,
  crash text,
  gym text,
  inositol text,
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

-- One row per logged period.
create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date,
  updated_at timestamptz not null default now(),
  unique (user_id, start_date)
);

alter table public.entries enable row level security;
alter table public.cycles enable row level security;

drop policy if exists "entries_select_own" on public.entries;
drop policy if exists "entries_insert_own" on public.entries;
drop policy if exists "entries_update_own" on public.entries;
drop policy if exists "entries_delete_own" on public.entries;
create policy "entries_select_own" on public.entries for select using (auth.uid() = user_id);
create policy "entries_insert_own" on public.entries for insert with check (auth.uid() = user_id);
create policy "entries_update_own" on public.entries for update using (auth.uid() = user_id);
create policy "entries_delete_own" on public.entries for delete using (auth.uid() = user_id);

drop policy if exists "cycles_select_own" on public.cycles;
drop policy if exists "cycles_insert_own" on public.cycles;
drop policy if exists "cycles_update_own" on public.cycles;
drop policy if exists "cycles_delete_own" on public.cycles;
create policy "cycles_select_own" on public.cycles for select using (auth.uid() = user_id);
create policy "cycles_insert_own" on public.cycles for insert with check (auth.uid() = user_id);
create policy "cycles_update_own" on public.cycles for update using (auth.uid() = user_id);
create policy "cycles_delete_own" on public.cycles for delete using (auth.uid() = user_id);
