-- WorkBox core schema
-- Run this in the Supabase SQL editor

create table if not exists spaces (
  id text primary key,
  name text not null,
  icon text default '🚀',
  color text default '#7c3aed',
  org_id text,
  position int default 0,
  created_at timestamptz default now()
);

create table if not exists folders (
  id text primary key,
  name text not null,
  space_id text references spaces(id) on delete cascade,
  position int default 0,
  created_at timestamptz default now()
);

create table if not exists lists (
  id text primary key,
  name text not null,
  space_id text references spaces(id) on delete cascade,
  folder_id text references folders(id) on delete set null,
  color text default '#7c3aed',
  position int default 0,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id text primary key,
  title text not null,
  status text default 'todo' check (status in ('todo','in_progress','in_review','done')),
  priority text default 'normal' check (priority in ('urgent','high','normal','low')),
  list_id text references lists(id) on delete cascade,
  due_date date,
  description text,
  tags text[] default '{}',
  position int default 0,
  assignee_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists automations (
  id text primary key,
  name text not null,
  trigger_type text not null,
  trigger_value text,
  action_type text not null,
  action_value text,
  org_id text,
  enabled bool default true,
  run_count int default 0,
  created_at timestamptz default now()
);

create table if not exists notifications (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  body text,
  read bool default false,
  task_id text references tasks(id) on delete set null,
  created_at timestamptz default now()
);

-- RLS
alter table spaces enable row level security;
alter table folders enable row level security;
alter table lists enable row level security;
alter table tasks enable row level security;
alter table automations enable row level security;
alter table notifications enable row level security;

-- Policies (org-scoped via profiles join, simplified for now)
create policy "spaces_auth" on spaces for all to authenticated using (true) with check (true);
create policy "folders_auth" on folders for all to authenticated using (true) with check (true);
create policy "lists_auth" on lists for all to authenticated using (true) with check (true);
create policy "tasks_auth" on tasks for all to authenticated using (true) with check (true);
create policy "automations_auth" on automations for all to authenticated using (true) with check (true);
create policy "notifications_own" on notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Indexes
create index if not exists tasks_list_id_idx on tasks(list_id);
create index if not exists tasks_status_idx on tasks(status);
create index if not exists lists_space_id_idx on lists(space_id);
create index if not exists notifications_user_id_idx on notifications(user_id);
create index if not exists notifications_read_idx on notifications(user_id, read);
