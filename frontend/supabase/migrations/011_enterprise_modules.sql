-- Enterprise modules: Knowledge Base, CRM, HR, Documents, Budget
-- Run in Supabase SQL Editor

-- ── Knowledge Base ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_categories (
  id text PRIMARY KEY DEFAULT 'kbc' || extract(epoch from now())::text || floor(random()*1000)::text,
  name text NOT NULL,
  icon text DEFAULT '📁',
  org_id text,
  parent_id text REFERENCES kb_categories(id) ON DELETE SET NULL,
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kb_articles (
  id text PRIMARY KEY DEFAULT 'kba' || extract(epoch from now())::text || floor(random()*1000)::text,
  title text NOT NULL DEFAULT 'Untitled Article',
  content text DEFAULT '',
  summary text,
  category_id text REFERENCES kb_categories(id) ON DELETE SET NULL,
  org_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  tags text[] DEFAULT '{}',
  published boolean DEFAULT true,
  views int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_org ON kb_articles(org_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_cats_org ON kb_categories(org_id);

ALTER TABLE kb_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_cats_auth" ON kb_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "kb_articles_auth" ON kb_articles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── CRM ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_companies (
  id text PRIMARY KEY DEFAULT 'cco' || extract(epoch from now())::text || floor(random()*1000)::text,
  name text NOT NULL,
  industry text,
  website text,
  phone text,
  email text,
  size text DEFAULT 'small',
  status text DEFAULT 'prospect',
  org_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id text PRIMARY KEY DEFAULT 'cct' || extract(epoch from now())::text || floor(random()*1000)::text,
  first_name text NOT NULL,
  last_name text,
  email text,
  phone text,
  job_title text,
  company_id text REFERENCES crm_companies(id) ON DELETE SET NULL,
  org_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tags text[] DEFAULT '{}',
  status text DEFAULT 'lead',
  notes text,
  last_contacted timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_deals (
  id text PRIMARY KEY DEFAULT 'cdl' || extract(epoch from now())::text || floor(random()*1000)::text,
  title text NOT NULL,
  value numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  stage text DEFAULT 'prospect',
  contact_id text REFERENCES crm_contacts(id) ON DELETE SET NULL,
  company_id text REFERENCES crm_companies(id) ON DELETE SET NULL,
  org_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expected_close date,
  probability int DEFAULT 50,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_org ON crm_contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_companies_org ON crm_companies(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_org ON crm_deals(org_id, stage);

ALTER TABLE crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_companies_auth" ON crm_companies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_contacts_auth" ON crm_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_deals_auth" ON crm_deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── HR / People ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_employees (
  id text PRIMARY KEY DEFAULT 'hre' || extract(epoch from now())::text || floor(random()*1000)::text,
  full_name text NOT NULL,
  email text,
  phone text,
  job_title text,
  department text,
  employment_type text DEFAULT 'full_time',
  status text DEFAULT 'active',
  start_date date,
  org_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  manager_id text REFERENCES hr_employees(id) ON DELETE SET NULL,
  location text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id text PRIMARY KEY DEFAULT 'hrl' || extract(epoch from now())::text || floor(random()*1000)::text,
  employee_id text NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  type text DEFAULT 'annual',
  start_date date NOT NULL,
  end_date date NOT NULL,
  days int DEFAULT 1,
  status text DEFAULT 'pending',
  reason text,
  org_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_employees_org ON hr_employees(org_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_leave_org ON hr_leave_requests(org_id, status);

ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_employees_auth" ON hr_employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hr_leave_auth" ON hr_leave_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Documents ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_documents (
  id text PRIMARY KEY DEFAULT 'doc' || extract(epoch from now())::text || floor(random()*1000)::text,
  name text NOT NULL,
  description text,
  content text,
  file_url text,
  file_type text,
  file_size int,
  folder text DEFAULT 'General',
  org_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  version int DEFAULT 1,
  status text DEFAULT 'draft',
  tags text[] DEFAULT '{}',
  expires_at date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docs_org ON org_documents(org_id, folder, updated_at DESC);

ALTER TABLE org_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_auth" ON org_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Budget ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS budgets (
  id text PRIMARY KEY DEFAULT 'bgt' || extract(epoch from now())::text || floor(random()*1000)::text,
  name text NOT NULL,
  description text,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'USD',
  period_start date,
  period_end date,
  status text DEFAULT 'active',
  org_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_items (
  id text PRIMARY KEY DEFAULT 'bgi' || extract(epoch from now())::text || floor(random()*1000)::text,
  budget_id text NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  allocated numeric DEFAULT 0,
  spent numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budgets_org ON budgets(org_id);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets_auth" ON budgets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "budget_items_auth" ON budget_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
