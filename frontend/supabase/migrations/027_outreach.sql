-- ============================================================
-- 027: Outreach engine — campaigns to CRM contacts (ported from Advisor
-- Vantage, made multi-tenant). Run in the Supabase SQL editor.
-- Server-only writes (revoke client grants) + org-scoped reads, matching
-- the security model in migrations 016/024/025.
-- ============================================================

-- Optional per-org sending identities (from-name/email). MVP can send from a
-- single configured domain, but this keeps the door open for multi-inbox.
create table if not exists public.sending_accounts (
  id           uuid primary key default gen_random_uuid(),
  org_id       text,
  email        text not null,
  domain       text,
  display_name text,
  connected    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_sending_accounts_org on public.sending_accounts (org_id);

create table if not exists public.campaigns (
  id                 uuid primary key default gen_random_uuid(),
  org_id             text,
  name               text not null,
  intent             text,                       -- shared brief used to draft each email
  sending_account_id uuid references public.sending_accounts (id) on delete set null,
  status             text not null default 'draft'
                       check (status in ('draft','ready','active','completed','stopped')),
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists idx_campaigns_org on public.campaigns (org_id);
create index if not exists idx_campaigns_status on public.campaigns (status);

create table if not exists public.campaign_emails (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  contact_id  text not null references public.crm_contacts (id) on delete cascade,
  step_number int not null default 1,
  to_email    text,
  subject     text not null default '',
  body        text not null default '',
  status      text not null default 'draft'
                check (status in ('draft','approved','excluded','scheduled','sent','delivered','opened','replied','bounced','failed')),
  provider_id text,                              -- id returned by the email provider
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (campaign_id, contact_id, step_number)
);
create index if not exists idx_campaign_emails_campaign on public.campaign_emails (campaign_id);
create index if not exists idx_campaign_emails_contact on public.campaign_emails (contact_id);
create index if not exists idx_campaign_emails_provider on public.campaign_emails (provider_id);

-- RLS: reads scoped to the caller's org; writes are server-only (service role).
alter table public.sending_accounts enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_emails enable row level security;

drop policy if exists sending_accounts_read on public.sending_accounts;
create policy sending_accounts_read on public.sending_accounts for select
  using (org_id in (select organization_id from public.profiles where id = auth.uid()));

drop policy if exists campaigns_read on public.campaigns;
create policy campaigns_read on public.campaigns for select
  using (org_id in (select organization_id from public.profiles where id = auth.uid()));

drop policy if exists campaign_emails_read on public.campaign_emails;
create policy campaign_emails_read on public.campaign_emails for select
  using (campaign_id in (
    select id from public.campaigns
    where org_id in (select organization_id from public.profiles where id = auth.uid())
  ));

revoke insert, update, delete on public.sending_accounts from authenticated, anon;
revoke insert, update, delete on public.campaigns from authenticated, anon;
revoke insert, update, delete on public.campaign_emails from authenticated, anon;
