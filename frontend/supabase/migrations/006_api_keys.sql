-- WorkBox API Keys for external integrations (MCP, scripts, CI)

create table if not exists api_keys (
  id          text primary key default gen_random_uuid()::text,
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  key_hash    text not null unique,  -- sha256 of the raw key, never stored plain
  key_prefix  text not null,         -- first 12 chars shown in UI (e.g. wbx_abc12345)
  last_used_at timestamptz,
  active      bool default true,
  created_at  timestamptz default now()
);

alter table api_keys enable row level security;
create policy "api_keys_self" on api_keys for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
