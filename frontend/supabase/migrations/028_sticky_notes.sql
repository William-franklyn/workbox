-- 028: Sticky notes — floating colored reminder notes. Run in SQL editor.
-- Server-only writes + per-user RLS (a note belongs to its creator).

create table if not exists public.sticky_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     text,
  content    text not null default '',
  color      text not null default 'yellow',
  x          int not null default 40,
  y          int not null default 40,
  remind_at  timestamptz,
  reminded   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sticky_notes_user on public.sticky_notes (user_id);
create index if not exists idx_sticky_notes_remind on public.sticky_notes (remind_at) where remind_at is not null and reminded = false;

alter table public.sticky_notes enable row level security;

drop policy if exists sticky_notes_read on public.sticky_notes;
create policy sticky_notes_read on public.sticky_notes for select using (user_id = auth.uid());

revoke insert, update, delete on public.sticky_notes from authenticated, anon;
