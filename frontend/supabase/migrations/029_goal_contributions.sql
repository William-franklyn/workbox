-- ============================================================
-- 029: Goal contributions — a per-member log of key-result progress
-- changes, so a team can see who moved a goal and by how much.
-- Run in Supabase SQL editor.
-- ============================================================

create table if not exists goal_contributions (
  id             text primary key,
  org_id         uuid,
  goal_id        text not null references goals(id) on delete cascade,
  key_result_id  text references key_results(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete set null,
  delta          numeric not null,          -- signed change (+ increment / − decrement)
  new_value      numeric,                   -- key-result value after the change
  created_at     timestamptz not null default now()
);

create index if not exists goal_contributions_goal_idx on goal_contributions (goal_id);
create index if not exists goal_contributions_user_idx on goal_contributions (user_id);

-- RLS on, no policies: reads/writes go through the service role in the API
-- (same model as goal_members in 023). Direct client access is denied.
alter table goal_contributions enable row level security;
