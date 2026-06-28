-- Billing: time entries, expenses, invoices

create table if not exists time_entries (
  id text primary key,
  org_id text,
  user_id uuid references auth.users(id) on delete cascade,
  task_id text references tasks(id) on delete set null,
  description text not null,
  date date not null,
  hours numeric(6,2) not null default 0,
  hourly_rate numeric(10,2) default 0,
  billable bool default true,
  created_at timestamptz default now()
);

create table if not exists expenses (
  id text primary key,
  org_id text,
  user_id uuid references auth.users(id) on delete cascade,
  description text not null,
  category text default 'other',
  amount numeric(10,2) not null,
  currency text default 'USD',
  date date not null,
  billable bool default true,
  created_at timestamptz default now()
);

create table if not exists invoices (
  id text primary key,
  org_id text,
  user_id uuid references auth.users(id) on delete cascade,
  invoice_number text not null,
  client_name text not null,
  client_email text,
  status text default 'draft' check (status in ('draft','sent','paid','overdue')),
  items jsonb default '[]',
  subtotal numeric(10,2) default 0,
  tax_rate numeric(5,2) default 0,
  tax_amount numeric(10,2) default 0,
  total numeric(10,2) default 0,
  notes text,
  due_date date,
  created_at timestamptz default now()
);

alter table time_entries enable row level security;
alter table expenses enable row level security;
alter table invoices enable row level security;

create policy "time_entries_auth" on time_entries for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "expenses_auth"     on expenses     for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "invoices_auth"     on invoices     for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
