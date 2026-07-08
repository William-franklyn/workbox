-- ═══════════════════════════════════════════════════════════════════════════
-- 016: Organizations, RBAC roles, and real multi-tenant RLS
--
-- Before this migration, almost every table had `USING (true)` policies:
-- any authenticated user could read/write every organization's data.
-- This migration:
--   1. Creates a real `organizations` table (backfilled from profiles)
--   2. Denormalizes org_id onto child tables (tasks, lists, folders, …)
--      with triggers that auto-fill it from the parent on insert
--   3. Replaces all USING(true) policies with org-scoped RBAC policies
--   4. Enables RLS on tables that had none (they were open via PostgREST)
--
-- Roles (profiles.role): owner | admin | member | guest
--   owner/admin  → org settings, members, billing, automations, HR, budgets
--   member       → full CRUD on workspace content within their org
--   guest        → read-only, limited to spaces granted in space_permissions
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Organizations ─────────────────────────────────────────────────────────

create table if not exists organizations (
  id text primary key                        -- historically the founder's uuid
);

-- The live database predates these migration files in places: organizations.id,
-- profiles.organization_id, documents.organization_id (and possibly others)
-- exist as uuid, while this schema treats org ids as text everywhere.
-- Normalize ALL uuid org-id columns to text in one pass:
--   1. find every public column named org_id / organization_id (plus
--      organizations.id) whose type is uuid
--   2. drop the RLS policies on those tables (they block ALTER TYPE) and any
--      FK constraints the column participates in (either side)
--   3. convert the columns to text
--   4. recreate the FKs, and give converted tables not otherwise covered by
--      this migration a replacement org-scoped policy
do $$
declare
  col record;
  fk record;
  pol record;
begin
  create temp table if not exists _dropped_fks
    (tbl text, conname text, condef text) on commit drop;
  create temp table if not exists _converted_tables (tbl text) on commit drop;
  create temp table if not exists _policy_tables (tbl text) on commit drop;

  for col in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and data_type = 'uuid'
      and (
        column_name in ('org_id', 'organization_id')
        or (table_name = 'organizations' and column_name = 'id')
      )
  loop
    -- Policies on this table may reference the column and block ALTER TYPE
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = col.table_name
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, col.table_name);
      insert into _policy_tables values (col.table_name);
    end loop;

    -- Policies on OTHER tables can reference this column too (e.g. a
    -- team_messages policy with a subquery on profiles.organization_id).
    -- pg_depend records exactly these dependencies — drop them all.
    for pol in
      select p.polname, c.relname
      from pg_depend d
      join pg_policy p on p.oid = d.objid and d.classid = 'pg_policy'::regclass
      join pg_class c on c.oid = p.polrelid
      where d.refclassid = 'pg_class'::regclass
        and d.refobjid = format('public.%I', col.table_name)::regclass
        and d.refobjsubid = (
          select attnum from pg_attribute
          where attrelid = format('public.%I', col.table_name)::regclass
            and attname = col.column_name
        )
    loop
      execute format('drop policy if exists %I on public.%I', pol.polname, pol.relname);
      insert into _policy_tables values (pol.relname);
    end loop;

    -- FK constraints where this column participates, as source or target
    for fk in
      select con.conname, src.relname as src_table, pg_get_constraintdef(con.oid) as condef
      from pg_constraint con
      join pg_class src on src.oid = con.conrelid
      join pg_namespace ns on ns.oid = src.relnamespace and ns.nspname = 'public'
      where con.contype = 'f'
        and (
          (src.relname = col.table_name and exists (
            select 1 from pg_attribute a
            where a.attrelid = con.conrelid and a.attnum = any(con.conkey)
              and a.attname = col.column_name))
          or exists (
            select 1 from pg_class tgt
            join pg_attribute a on a.attrelid = con.confrelid and a.attnum = any(con.confkey)
            where tgt.oid = con.confrelid and tgt.relname = col.table_name
              and a.attname = col.column_name)
        )
    loop
      if not exists (select 1 from _dropped_fks d where d.conname = fk.conname and d.tbl = fk.src_table) then
        insert into _dropped_fks values (fk.src_table, fk.conname, fk.condef);
        execute format('alter table public.%I drop constraint %I', fk.src_table, fk.conname);
      end if;
    end loop;

    -- uuid defaults (e.g. gen_random_uuid()) can't be cast automatically
    execute format('alter table public.%I alter column %I drop default', col.table_name, col.column_name);
    execute format('alter table public.%I alter column %I type text using %I::text',
                   col.table_name, col.column_name, col.column_name);

    insert into _converted_tables values (col.table_name);
  end loop;

  -- Recreate the FKs now that both sides are text
  for fk in select * from _dropped_fks loop
    begin
      execute format('alter table public.%I add constraint %I %s', fk.tbl, fk.conname, fk.condef);
    exception when others then null;
    end;
  end loop;

  -- Replacement org-scoped policies for every table whose policies were
  -- dropped above (converted tables AND tables like team_messages whose
  -- policies merely referenced a converted column), EXCEPT tables that get
  -- their real policies later in this migration.
  for col in
    select distinct tbl from (
      select tbl from _converted_tables
      union select tbl from _policy_tables
    ) affected
    where tbl not in (
      'profiles', 'organizations',
      'spaces', 'folders', 'lists', 'tasks',
      'task_comments', 'task_subtasks', 'task_dependencies',
      'docs', 'goals', 'key_results',
      'kb_categories', 'kb_articles',
      'crm_companies', 'crm_contacts', 'crm_deals',
      'hr_employees', 'hr_leave_requests',
      'org_documents', 'budgets', 'budget_items',
      'automations', 'activity_log', 'forms', 'form_submissions',
      'guest_invites', 'space_permissions', 'spreadsheets',
      'time_entries', 'expenses', 'invoices', 'notifications',
      'time_logs', 'api_keys'
    )
  loop
    for pol in
      select c.column_name from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = col.tbl
        and c.column_name in ('org_id', 'organization_id')
      limit 1
    loop
      begin
        execute format(
          'create policy %I on public.%I for all to authenticated '
          || 'using (%I = (select organization_id from profiles where id = auth.uid())) '
          || 'with check (%I = (select organization_id from profiles where id = auth.uid()))',
          col.tbl || '_org_scoped', col.tbl, pol.column_name, pol.column_name);
      exception when duplicate_object then null;
      end;
    end loop;
  end loop;

  -- organizations.id keeps a sensible default for future direct inserts
  if exists (select 1 from _converted_tables where tbl = 'organizations') then
    alter table organizations alter column id set default gen_random_uuid()::text;
  end if;
end $$;

-- The table may predate this migration with a different shape, so every
-- column is added individually (idempotent either way).
alter table organizations add column if not exists name text not null default 'My Workspace';
alter table organizations add column if not exists slug text;
alter table organizations add column if not exists logo_url text;
-- SaaS billing (wired up by /api/billing + Stripe webhook)
alter table organizations add column if not exists plan text not null default 'free';
alter table organizations add column if not exists plan_status text not null default 'active';
alter table organizations add column if not exists seats int not null default 5;
alter table organizations add column if not exists stripe_customer_id text;
alter table organizations add column if not exists stripe_subscription_id text;
alter table organizations add column if not exists trial_ends_at timestamptz;
alter table organizations add column if not exists settings jsonb not null default '{}';
alter table organizations add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table organizations add column if not exists created_at timestamptz not null default now();
alter table organizations add column if not exists updated_at timestamptz not null default now();

-- Normalize any pre-existing rows before adding constraints
update organizations set plan = 'free'
  where plan is null or plan not in ('free','pro','business','enterprise');
update organizations set plan_status = 'active'
  where plan_status is null or plan_status not in ('active','trialing','past_due','canceled');
update organizations set name = 'My Workspace' where name is null or name = '';
update organizations set seats = 5 where seats is null;
update organizations set settings = '{}' where settings is null;

-- Constraints / uniques (guarded so re-runs don't fail)
do $$ begin
  alter table organizations add constraint organizations_plan_check
    check (plan in ('free','pro','business','enterprise'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table organizations add constraint organizations_plan_status_check
    check (plan_status in ('active','trialing','past_due','canceled'));
exception when duplicate_object then null; end $$;

create unique index if not exists organizations_slug_key on organizations(slug) where slug is not null;
create unique index if not exists organizations_stripe_customer_key on organizations(stripe_customer_id) where stripe_customer_id is not null;

-- slug is optional in this schema; a pre-existing table may have it NOT NULL
alter table organizations alter column slug drop not null;

-- Backfill one organization per distinct profiles.organization_id.
-- The founding user is the one whose id::text equals the org id (see signup).
insert into organizations (id, name, slug, created_by, created_at)
select
  p.organization_id,
  coalesce(nullif(f.full_name, '') || '''s Workspace', 'My Workspace'),
  lower(regexp_replace(coalesce(nullif(f.full_name, ''), 'workspace'), '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || substr(p.organization_id, 1, 8),
  f.id,
  coalesce(f.created_at, now())
from (select distinct organization_id from profiles where organization_id is not null) p
left join profiles f on f.id::text = p.organization_id
on conflict (id) do nothing;

-- Founding users become owners; constrain roles going forward.
update profiles set role = 'owner'
where organization_id is not null and id::text = organization_id and (role is null or role not in ('owner'));

update profiles set role = 'member'
where role is null or role not in ('owner','admin','member','guest');

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('owner','admin','member','guest'));

-- ── 2. Auth helper functions (used by every policy) ─────────────────────────
-- SECURITY DEFINER so they can read profiles regardless of profiles' own RLS.

create or replace function auth_org_id() returns text
language sql stable security definer set search_path = public as $$
  select organization_id from profiles where id = auth.uid()
$$;

create or replace function auth_org_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_org_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('owner','admin') from profiles where id = auth.uid()), false)
$$;

-- Spaces a guest has been explicitly granted (non-guests never need this).
create or replace function guest_space_ids() returns setof text
language sql stable security definer set search_path = public as $$
  select space_id from space_permissions where user_id = auth.uid()
$$;

-- ── 3. Denormalize org_id onto child tables ─────────────────────────────────

alter table folders        add column if not exists org_id text;
alter table lists          add column if not exists org_id text;
alter table tasks          add column if not exists org_id text;
alter table tasks          add column if not exists space_id text;
alter table key_results    add column if not exists org_id text;
alter table task_comments  add column if not exists org_id text;
alter table task_subtasks  add column if not exists org_id text;
alter table task_dependencies add column if not exists org_id text;
alter table budget_items   add column if not exists org_id text;
alter table form_submissions add column if not exists org_id text;

-- Backfills
update folders f set org_id = s.org_id
  from spaces s where f.space_id = s.id and f.org_id is null;

update lists l set org_id = s.org_id
  from spaces s where l.space_id = s.id and l.org_id is null;

update tasks t set org_id = s.org_id, space_id = l.space_id
  from lists l join spaces s on s.id = l.space_id
  where t.list_id = l.id and (t.org_id is null or t.space_id is null);

update key_results kr set org_id = g.org_id
  from goals g where kr.goal_id = g.id and kr.org_id is null;

update task_comments c set org_id = t.org_id
  from tasks t where c.task_id = t.id and c.org_id is null;

update task_subtasks st set org_id = t.org_id
  from tasks t where st.task_id = t.id and st.org_id is null;

update task_dependencies td set org_id = t.org_id
  from tasks t where td.task_id = t.id and td.org_id is null;

update budget_items bi set org_id = b.org_id
  from budgets b where bi.budget_id = b.id and bi.org_id is null;

update form_submissions fs set org_id = f.org_id
  from forms f where fs.form_id = f.id and fs.org_id is null;

-- Auto-fill triggers so existing insert paths keep working unchanged.

create or replace function fill_org_from_space() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null and new.space_id is not null then
    select org_id into new.org_id from spaces where id = new.space_id;
  end if;
  return new;
end $$;

create or replace function fill_task_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.org_id is null or new.space_id is null) and new.list_id is not null then
    select l.org_id, l.space_id into new.org_id, new.space_id
    from lists l where l.id = new.list_id;
  end if;
  return new;
end $$;

create or replace function fill_org_from_task() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null and new.task_id is not null then
    select org_id into new.org_id from tasks where id = new.task_id;
  end if;
  return new;
end $$;

create or replace function fill_org_from_goal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null and new.goal_id is not null then
    select org_id into new.org_id from goals where id = new.goal_id;
  end if;
  return new;
end $$;

create or replace function fill_org_from_budget() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null and new.budget_id is not null then
    select org_id into new.org_id from budgets where id = new.budget_id;
  end if;
  return new;
end $$;

create or replace function fill_org_from_form() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null and new.form_id is not null then
    select org_id into new.org_id from forms where id = new.form_id;
  end if;
  return new;
end $$;

drop trigger if exists folders_fill_org on folders;
create trigger folders_fill_org before insert on folders
  for each row execute function fill_org_from_space();

drop trigger if exists lists_fill_org on lists;
create trigger lists_fill_org before insert on lists
  for each row execute function fill_org_from_space();

drop trigger if exists tasks_fill_org on tasks;
create trigger tasks_fill_org before insert or update of list_id on tasks
  for each row execute function fill_task_org();

drop trigger if exists key_results_fill_org on key_results;
create trigger key_results_fill_org before insert on key_results
  for each row execute function fill_org_from_goal();

drop trigger if exists task_comments_fill_org on task_comments;
create trigger task_comments_fill_org before insert on task_comments
  for each row execute function fill_org_from_task();

drop trigger if exists task_subtasks_fill_org on task_subtasks;
create trigger task_subtasks_fill_org before insert on task_subtasks
  for each row execute function fill_org_from_task();

drop trigger if exists task_dependencies_fill_org on task_dependencies;
create trigger task_dependencies_fill_org before insert on task_dependencies
  for each row execute function fill_org_from_task();

drop trigger if exists budget_items_fill_org on budget_items;
create trigger budget_items_fill_org before insert on budget_items
  for each row execute function fill_org_from_budget();

drop trigger if exists form_submissions_fill_org on form_submissions;
create trigger form_submissions_fill_org before insert on form_submissions
  for each row execute function fill_org_from_form();

-- Indexes for the new org_id columns (every policy filters on them)
create index if not exists idx_folders_org on folders(org_id);
create index if not exists idx_lists_org on lists(org_id);
create index if not exists idx_tasks_org on tasks(org_id);
create index if not exists idx_tasks_space on tasks(space_id);
create index if not exists idx_key_results_org on key_results(org_id);
create index if not exists idx_task_comments_org on task_comments(org_id);
create index if not exists idx_task_subtasks_org on task_subtasks(org_id);
create index if not exists idx_task_dependencies_org on task_dependencies(org_id);
create index if not exists idx_budget_items_org on budget_items(org_id);
create index if not exists idx_form_submissions_org on form_submissions(org_id);

-- ── 4. Organizations RLS ─────────────────────────────────────────────────────

alter table organizations enable row level security;

drop policy if exists "org_member_read" on organizations;
create policy "org_member_read" on organizations for select to authenticated
  using (id = (select auth_org_id()));

drop policy if exists "org_admin_update" on organizations;
create policy "org_admin_update" on organizations for update to authenticated
  using (id = (select auth_org_id()) and (select is_org_admin()))
  with check (id = (select auth_org_id()));

-- ── 5. Profiles: restrict directory reads to same org ───────────────────────

-- Users manage their own profile row (recreated here because the uuid→text
-- conversion above drops all pre-existing profiles policies).
drop policy if exists "profiles_own" on profiles;
create policy "profiles_own" on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_read" on profiles;
create policy "profiles_read" on profiles for select to authenticated
  using (
    id = auth.uid()
    or (organization_id is not null and organization_id = (select auth_org_id()))
  );

-- ── 6. Workspace content: spaces / folders / lists / tasks ──────────────────
-- Members: full CRUD within org. Guests: read-only, only granted spaces.

drop policy if exists "spaces_auth" on spaces;
drop policy if exists "spaces_select" on spaces;
create policy "spaces_select" on spaces for select to authenticated
  using (
    org_id = (select auth_org_id())
    and ((select auth_org_role()) <> 'guest' or id in (select guest_space_ids()))
  );
drop policy if exists "spaces_write" on spaces;
create policy "spaces_write" on spaces for insert to authenticated
  with check (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest');
drop policy if exists "spaces_update" on spaces;
create policy "spaces_update" on spaces for update to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (org_id = (select auth_org_id()));
drop policy if exists "spaces_delete" on spaces;
create policy "spaces_delete" on spaces for delete to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest');

drop policy if exists "folders_auth" on folders;
drop policy if exists "folders_select" on folders;
create policy "folders_select" on folders for select to authenticated
  using (
    org_id = (select auth_org_id())
    and ((select auth_org_role()) <> 'guest' or space_id in (select guest_space_ids()))
  );
drop policy if exists "folders_write" on folders;
create policy "folders_write" on folders for insert to authenticated
  with check ((org_id is null or org_id = (select auth_org_id())) and (select auth_org_role()) <> 'guest');
drop policy if exists "folders_update" on folders;
create policy "folders_update" on folders for update to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (org_id = (select auth_org_id()));
drop policy if exists "folders_delete" on folders;
create policy "folders_delete" on folders for delete to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest');

drop policy if exists "lists_auth" on lists;
drop policy if exists "lists_select" on lists;
create policy "lists_select" on lists for select to authenticated
  using (
    org_id = (select auth_org_id())
    and ((select auth_org_role()) <> 'guest' or space_id in (select guest_space_ids()))
  );
drop policy if exists "lists_write" on lists;
create policy "lists_write" on lists for insert to authenticated
  with check ((org_id is null or org_id = (select auth_org_id())) and (select auth_org_role()) <> 'guest');
drop policy if exists "lists_update" on lists;
create policy "lists_update" on lists for update to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (org_id = (select auth_org_id()));
drop policy if exists "lists_delete" on lists;
create policy "lists_delete" on lists for delete to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest');

drop policy if exists "tasks_auth" on tasks;
drop policy if exists "tasks_select" on tasks;
create policy "tasks_select" on tasks for select to authenticated
  using (
    org_id = (select auth_org_id())
    and ((select auth_org_role()) <> 'guest' or space_id in (select guest_space_ids()))
  );
drop policy if exists "tasks_write" on tasks;
create policy "tasks_write" on tasks for insert to authenticated
  with check ((org_id is null or org_id = (select auth_org_id())) and (select auth_org_role()) <> 'guest');
drop policy if exists "tasks_update" on tasks;
create policy "tasks_update" on tasks for update to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (org_id is null or org_id = (select auth_org_id()));
drop policy if exists "tasks_delete" on tasks;
create policy "tasks_delete" on tasks for delete to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest');

-- ── 7. Task children: comments / subtasks / dependencies ────────────────────

drop policy if exists "comments_auth" on task_comments;
drop policy if exists "task_comments_org" on task_comments;
create policy "task_comments_org" on task_comments for all to authenticated
  using (org_id = (select auth_org_id()))
  with check (org_id is null or org_id = (select auth_org_id()));

drop policy if exists "subtasks_auth" on task_subtasks;
drop policy if exists "task_subtasks_org" on task_subtasks;
create policy "task_subtasks_org" on task_subtasks for all to authenticated
  using (org_id = (select auth_org_id()))
  with check (org_id is null or org_id = (select auth_org_id()));

alter table task_dependencies enable row level security;
drop policy if exists "task_dependencies_org" on task_dependencies;
create policy "task_dependencies_org" on task_dependencies for all to authenticated
  using (org_id = (select auth_org_id()))
  with check (org_id is null or org_id = (select auth_org_id()));

-- ── 8. Docs / goals / key results ────────────────────────────────────────────

drop policy if exists "docs_auth" on docs;
drop policy if exists "docs_org" on docs;
create policy "docs_org" on docs for all to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (org_id = (select auth_org_id()));

drop policy if exists "goals_auth" on goals;
drop policy if exists "goals_org" on goals;
create policy "goals_org" on goals for all to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (org_id = (select auth_org_id()));

drop policy if exists "key_results_auth" on key_results;
drop policy if exists "key_results_org" on key_results;
create policy "key_results_org" on key_results for all to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (org_id is null or org_id = (select auth_org_id()));

-- ── 9. Knowledge base / CRM ──────────────────────────────────────────────────

drop policy if exists "kb_cats_auth" on kb_categories;
drop policy if exists "kb_cats_org" on kb_categories;
create policy "kb_cats_org" on kb_categories for all to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (org_id = (select auth_org_id()));

drop policy if exists "kb_articles_auth" on kb_articles;
drop policy if exists "kb_articles_org" on kb_articles;
create policy "kb_articles_org" on kb_articles for all to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (org_id = (select auth_org_id()));

drop policy if exists "crm_companies_auth" on crm_companies;
drop policy if exists "crm_companies_org" on crm_companies;
create policy "crm_companies_org" on crm_companies for all to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (org_id = (select auth_org_id()));

drop policy if exists "crm_contacts_auth" on crm_contacts;
drop policy if exists "crm_contacts_org" on crm_contacts;
create policy "crm_contacts_org" on crm_contacts for all to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (org_id = (select auth_org_id()));

drop policy if exists "crm_deals_auth" on crm_deals;
drop policy if exists "crm_deals_org" on crm_deals;
create policy "crm_deals_org" on crm_deals for all to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (org_id = (select auth_org_id()));

-- ── 10. HR (admin-only: sensitive) ───────────────────────────────────────────

drop policy if exists "hr_employees_auth" on hr_employees;
drop policy if exists "hr_employees_admin" on hr_employees;
create policy "hr_employees_admin" on hr_employees for all to authenticated
  using (org_id = (select auth_org_id()) and (select is_org_admin()))
  with check (org_id = (select auth_org_id()));
-- Employees can still see their own record
drop policy if exists "hr_employees_self" on hr_employees;
create policy "hr_employees_self" on hr_employees for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "hr_leave_auth" on hr_leave_requests;
drop policy if exists "hr_leave_admin" on hr_leave_requests;
create policy "hr_leave_admin" on hr_leave_requests for all to authenticated
  using (org_id = (select auth_org_id()) and (select is_org_admin()))
  with check (org_id = (select auth_org_id()));
-- Members can view + create their own leave requests via their employee record
drop policy if exists "hr_leave_self" on hr_leave_requests;
create policy "hr_leave_self" on hr_leave_requests for select to authenticated
  using (employee_id in (select id from hr_employees where user_id = auth.uid()));
drop policy if exists "hr_leave_self_insert" on hr_leave_requests;
create policy "hr_leave_self_insert" on hr_leave_requests for insert to authenticated
  with check (
    org_id = (select auth_org_id())
    and employee_id in (select id from hr_employees where user_id = auth.uid())
  );

-- ── 11. Documents / budgets ──────────────────────────────────────────────────

drop policy if exists "docs_auth" on org_documents;
drop policy if exists "org_documents_org" on org_documents;
create policy "org_documents_org" on org_documents for all to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (org_id = (select auth_org_id()));

drop policy if exists "budgets_auth" on budgets;
drop policy if exists "budgets_admin" on budgets;
create policy "budgets_admin" on budgets for all to authenticated
  using (org_id = (select auth_org_id()) and (select is_org_admin()))
  with check (org_id = (select auth_org_id()));
drop policy if exists "budgets_member_read" on budgets;
create policy "budgets_member_read" on budgets for select to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest');

drop policy if exists "budget_items_auth" on budget_items;
drop policy if exists "budget_items_admin" on budget_items;
create policy "budget_items_admin" on budget_items for all to authenticated
  using (org_id = (select auth_org_id()) and (select is_org_admin()))
  with check (org_id is null or org_id = (select auth_org_id()));
drop policy if exists "budget_items_member_read" on budget_items;
create policy "budget_items_member_read" on budget_items for select to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest');

-- ── 12. Automations (admin write, member read) ───────────────────────────────

drop policy if exists "automations_auth" on automations;
drop policy if exists "automations_read" on automations;
create policy "automations_read" on automations for select to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest');
drop policy if exists "automations_admin_write" on automations;
create policy "automations_admin_write" on automations for insert to authenticated
  with check (org_id = (select auth_org_id()) and (select is_org_admin()));
drop policy if exists "automations_admin_update" on automations;
create policy "automations_admin_update" on automations for update to authenticated
  using (org_id = (select auth_org_id()) and (select is_org_admin()))
  with check (org_id = (select auth_org_id()));
drop policy if exists "automations_admin_delete" on automations;
create policy "automations_admin_delete" on automations for delete to authenticated
  using (org_id = (select auth_org_id()) and (select is_org_admin()));

-- ── 13. Tables that had NO RLS at all (open via PostgREST until now) ─────────

alter table activity_log enable row level security;
drop policy if exists "activity_log_org_read" on activity_log;
create policy "activity_log_org_read" on activity_log for select to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest');
-- Inserts happen via SECURITY DEFINER triggers and the service client only.

alter table forms enable row level security;
drop policy if exists "forms_org" on forms;
create policy "forms_org" on forms for all to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (org_id = (select auth_org_id()));

alter table form_submissions enable row level security;
drop policy if exists "form_submissions_org_read" on form_submissions;
create policy "form_submissions_org_read" on form_submissions for select to authenticated
  using (org_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest');
-- Public form submits go through the API with the service client.

alter table guest_invites enable row level security;
drop policy if exists "guest_invites_admin" on guest_invites;
create policy "guest_invites_admin" on guest_invites for all to authenticated
  using (org_id = (select auth_org_id()) and (select is_org_admin()))
  with check (org_id = (select auth_org_id()));

alter table space_permissions enable row level security;
drop policy if exists "space_permissions_read" on space_permissions;
create policy "space_permissions_read" on space_permissions for select to authenticated
  using (
    user_id = auth.uid()
    or space_id in (select id from spaces where org_id = (select auth_org_id()))
  );
drop policy if exists "space_permissions_admin_write" on space_permissions;
create policy "space_permissions_admin_write" on space_permissions for insert to authenticated
  with check (
    (select is_org_admin())
    and space_id in (select id from spaces where org_id = (select auth_org_id()))
  );
drop policy if exists "space_permissions_admin_update" on space_permissions;
create policy "space_permissions_admin_update" on space_permissions for update to authenticated
  using (
    (select is_org_admin())
    and space_id in (select id from spaces where org_id = (select auth_org_id()))
  );
drop policy if exists "space_permissions_admin_delete" on space_permissions;
create policy "space_permissions_admin_delete" on space_permissions for delete to authenticated
  using (
    (select is_org_admin())
    and space_id in (select id from spaces where org_id = (select auth_org_id()))
  );

alter table spreadsheets enable row level security;
drop policy if exists "spreadsheets_org" on spreadsheets;
create policy "spreadsheets_org" on spreadsheets for all to authenticated
  using (organization_id = (select auth_org_id()) and (select auth_org_role()) <> 'guest')
  with check (organization_id = (select auth_org_id()));

-- ── 14. Client billing tables: widen to org for admins (were self-only) ─────

drop policy if exists "time_entries_org_admin_read" on time_entries;
create policy "time_entries_org_admin_read" on time_entries for select to authenticated
  using (org_id = (select auth_org_id()) and (select is_org_admin()));

drop policy if exists "expenses_org_admin_read" on expenses;
create policy "expenses_org_admin_read" on expenses for select to authenticated
  using (org_id = (select auth_org_id()) and (select is_org_admin()));

drop policy if exists "invoices_org_admin_read" on invoices;
create policy "invoices_org_admin_read" on invoices for select to authenticated
  using (org_id = (select auth_org_id()) and (select is_org_admin()));
