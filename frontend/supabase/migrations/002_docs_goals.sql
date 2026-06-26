-- Docs and Goals tables
-- Run this in the Supabase SQL editor after 001_workbox_schema.sql

create table if not exists docs (
  id text primary key,
  title text not null default 'Untitled',
  blocks jsonb default '[]',
  org_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists goals (
  id text primary key,
  title text not null,
  description text,
  due_date date,
  org_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists key_results (
  id text primary key,
  goal_id text references goals(id) on delete cascade,
  title text not null,
  current_value numeric default 0,
  target_value numeric default 100,
  unit text default '%',
  created_at timestamptz default now()
);

alter table docs enable row level security;
alter table goals enable row level security;
alter table key_results enable row level security;

create policy "docs_auth" on docs for all to authenticated using (true) with check (true);
create policy "goals_auth" on goals for all to authenticated using (true) with check (true);
create policy "key_results_auth" on key_results for all to authenticated using (true) with check (true);

create index if not exists docs_org_id_idx on docs(org_id);
create index if not exists goals_org_id_idx on goals(org_id);
create index if not exists key_results_goal_id_idx on key_results(goal_id);
