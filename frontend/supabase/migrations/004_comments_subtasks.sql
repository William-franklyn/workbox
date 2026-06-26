-- Task comments and subtasks
-- Run in Supabase SQL editor

create table if not exists task_comments (
  id text primary key,
  task_id text references tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists task_subtasks (
  id text primary key,
  task_id text references tasks(id) on delete cascade,
  title text not null,
  completed boolean default false,
  position int default 0,
  created_at timestamptz default now()
);

alter table task_comments enable row level security;
alter table task_subtasks enable row level security;

create policy "comments_auth" on task_comments for all to authenticated using (true) with check (true);
create policy "subtasks_auth" on task_subtasks for all to authenticated using (true) with check (true);

create index if not exists comments_task_id_idx on task_comments(task_id);
create index if not exists subtasks_task_id_idx on task_subtasks(task_id);
