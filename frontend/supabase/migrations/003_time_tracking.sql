-- Time tracking
-- Run in Supabase SQL editor

create table if not exists time_logs (
  id text primary key,
  task_id text references tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  duration_minutes int not null default 0,
  note text,
  logged_at timestamptz default now()
);

alter table time_logs enable row level security;
create policy "time_logs_own" on time_logs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists time_logs_task_id_idx on time_logs(task_id);
create index if not exists time_logs_user_id_idx on time_logs(user_id);
