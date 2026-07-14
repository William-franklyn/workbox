-- ============================================================
-- 031: LinkedIn URL on CRM records. Lets you store a contact's (or
-- company's) LinkedIn profile — filled in-app or by the browser extension
-- when saving a lead from LinkedIn. Run in Supabase SQL editor.
-- ============================================================

alter table crm_contacts  add column if not exists linkedin_url text;
alter table crm_companies add column if not exists linkedin_url text;
