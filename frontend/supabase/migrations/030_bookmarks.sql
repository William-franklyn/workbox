-- ============================================================
-- 030: Bookmarks — Chrome-style folders of saved people, companies,
-- jobs, opportunities and links (populated in-app and by the browser
-- extension). Run in Supabase SQL editor.
-- ============================================================

create table if not exists bookmark_folders (
  id          text primary key,
  org_id      uuid,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default '#7c3aed',
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists bookmarks (
  id          text primary key,
  org_id      uuid,
  user_id     uuid not null references auth.users(id) on delete cascade,
  folder_id   text references bookmark_folders(id) on delete cascade,
  kind        text not null default 'link',   -- person|company|job|opportunity|training|link
  title       text not null,
  url         text,
  subtitle    text,                            -- role / company / short context
  notes       text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists bookmark_folders_user_idx on bookmark_folders (user_id);
create index if not exists bookmarks_folder_idx on bookmarks (folder_id);
create index if not exists bookmarks_user_idx on bookmarks (user_id);

-- RLS on, no policies: reads/writes go through the service role in the API
-- (same model as goal_members/goal_contributions). Direct client access denied.
alter table bookmark_folders enable row level security;
alter table bookmarks enable row level security;
