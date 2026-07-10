-- ============================================================
-- 023: Shared goals — personal vs team goals with participants
-- Run in Supabase SQL editor.
-- ============================================================

-- 'team' goals are visible to the whole workspace (current behavior);
-- 'private' goals are visible only to their creator.
alter table goals add column if not exists visibility text not null default 'team';

-- Participants invited to contribute to a goal. The creator is implicit;
-- participants (and admins/owner) may update key-result progress.
create table if not exists goal_members (
  goal_id text not null references goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (goal_id, user_id)
);

create index if not exists goal_members_user_idx on goal_members (user_id);

alter table goal_members enable row level security;
