-- 026: CRM contact enrichment metadata (Apollo.io)
alter table crm_contacts add column if not exists linkedin_url text;
alter table crm_contacts add column if not exists enriched_at timestamptz;
