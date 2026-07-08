-- ═══════════════════════════════════════════════════════════════════════════
-- 017: Growth features
--   1. Calendar event cache (stop hitting Google/Microsoft on every mount)
--   2. Full-text search indexes + unified search support
--   3. Outbound webhooks (subscriptions + delivery log)
--   4. Custom fields on tasks
--   5. Recurring tasks
--   6. Notification preferences
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Calendar event cache ──────────────────────────────────────────────────
-- One row per external event per user; refreshed in the background.

create table if not exists calendar_events_cache (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google','outlook')),
  event_id text not null,
  title text not null default '(No title)',
  start_at text not null,          -- ISO datetime, or YYYY-MM-DD for all-day
  end_at text not null,
  all_day boolean not null default false,
  meet_link text,
  external_link text,
  synced_at timestamptz not null default now(),
  unique (user_id, provider, event_id)
);

alter table calendar_events_cache enable row level security;
drop policy if exists "cal_cache_own" on calendar_events_cache;
create policy "cal_cache_own" on calendar_events_cache for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_cal_cache_user on calendar_events_cache(user_id, start_at);

-- ── 2. Full-text search ──────────────────────────────────────────────────────
-- Generated tsvector columns + GIN indexes on the main searchable tables.

alter table tasks add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored;
create index if not exists idx_tasks_search on tasks using gin(search_tsv);

alter table docs add column if not exists search_tsv tsvector
  generated always as (to_tsvector('simple', coalesce(title, ''))) stored;
create index if not exists idx_docs_search on docs using gin(search_tsv);

alter table kb_articles add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'B')
  ) stored;
create index if not exists idx_kb_articles_search on kb_articles using gin(search_tsv);

alter table org_documents add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored;
create index if not exists idx_org_documents_search on org_documents using gin(search_tsv);

alter table crm_companies add column if not exists search_tsv tsvector
  generated always as (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(industry, ''))) stored;
create index if not exists idx_crm_companies_search on crm_companies using gin(search_tsv);

alter table crm_contacts add column if not exists search_tsv tsvector
  generated always as (
    to_tsvector('simple', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(email, ''))
  ) stored;
create index if not exists idx_crm_contacts_search on crm_contacts using gin(search_tsv);

alter table goals add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored;
create index if not exists idx_goals_search on goals using gin(search_tsv);

alter table spreadsheets add column if not exists search_tsv tsvector
  generated always as (to_tsvector('simple', coalesce(name, ''))) stored;
create index if not exists idx_spreadsheets_search on spreadsheets using gin(search_tsv);

-- ── 3. Outbound webhooks ─────────────────────────────────────────────────────

create table if not exists webhook_subscriptions (
  id text primary key default 'wh' || gen_random_uuid()::text,
  org_id text not null,
  url text not null,
  -- Which events to deliver: task.created, task.updated, task.deleted,
  -- task.status_changed, comment.created, doc.created, form.submitted
  events text[] not null default '{}',
  secret text not null,             -- HMAC signing secret, shown once
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_delivery_at timestamptz,
  last_delivery_status int
);

create table if not exists webhook_deliveries (
  id bigint generated always as identity primary key,
  subscription_id text not null references webhook_subscriptions(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  status int,
  error text,
  delivered_at timestamptz not null default now()
);

alter table webhook_subscriptions enable row level security;
drop policy if exists "webhooks_admin" on webhook_subscriptions;
create policy "webhooks_admin" on webhook_subscriptions for all to authenticated
  using (org_id = (select auth_org_id()) and (select is_org_admin()))
  with check (org_id = (select auth_org_id()));

alter table webhook_deliveries enable row level security;
drop policy if exists "webhook_deliveries_admin" on webhook_deliveries;
create policy "webhook_deliveries_admin" on webhook_deliveries for select to authenticated
  using (subscription_id in (
    select id from webhook_subscriptions where org_id = (select auth_org_id())
  ) and (select is_org_admin()));

create index if not exists idx_webhooks_org on webhook_subscriptions(org_id) where active;
create index if not exists idx_webhook_deliveries_sub on webhook_deliveries(subscription_id, delivered_at desc);

-- ── 4. Custom fields on tasks ────────────────────────────────────────────────
-- Definitions are per-org; values live in a jsonb column keyed by def id.

create table if not exists custom_field_defs (
  id text primary key default 'cf' || gen_random_uuid()::text,
  org_id text not null,
  name text not null,
  -- text | number | select | multi_select | date | checkbox | url | person
  type text not null check (type in ('text','number','select','multi_select','date','checkbox','url','person')),
  options jsonb not null default '[]',   -- for select/multi_select: ["Option A", ...]
  space_id text references spaces(id) on delete cascade,  -- null = org-wide
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table tasks add column if not exists custom_fields jsonb not null default '{}';

alter table custom_field_defs enable row level security;
drop policy if exists "custom_fields_read" on custom_field_defs;
create policy "custom_fields_read" on custom_field_defs for select to authenticated
  using (org_id = (select auth_org_id()));
drop policy if exists "custom_fields_admin_write" on custom_field_defs;
create policy "custom_fields_admin_write" on custom_field_defs for insert to authenticated
  with check (org_id = (select auth_org_id()) and (select is_org_admin()));
drop policy if exists "custom_fields_admin_update" on custom_field_defs;
create policy "custom_fields_admin_update" on custom_field_defs for update to authenticated
  using (org_id = (select auth_org_id()) and (select is_org_admin()));
drop policy if exists "custom_fields_admin_delete" on custom_field_defs;
create policy "custom_fields_admin_delete" on custom_field_defs for delete to authenticated
  using (org_id = (select auth_org_id()) and (select is_org_admin()));

create index if not exists idx_custom_field_defs_org on custom_field_defs(org_id, position);

-- ── 5. Recurring tasks ───────────────────────────────────────────────────────
-- When a recurring task is completed, the API creates the next occurrence.

alter table tasks add column if not exists recurrence text
  check (recurrence is null or recurrence in ('daily','weekdays','weekly','biweekly','monthly','yearly'));
alter table tasks add column if not exists recurrence_until date;
alter table tasks add column if not exists recurring_parent_id text;

create index if not exists idx_tasks_recurring on tasks(recurring_parent_id) where recurring_parent_id is not null;

-- ── 6. Notification preferences ──────────────────────────────────────────────

create table if not exists notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_digest text not null default 'daily' check (email_digest in ('off','daily','weekly')),
  notify_assigned boolean not null default true,
  notify_comments boolean not null default true,
  notify_due_soon boolean not null default true,
  notify_mentions boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table notification_prefs enable row level security;
drop policy if exists "notification_prefs_own" on notification_prefs;
create policy "notification_prefs_own" on notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
