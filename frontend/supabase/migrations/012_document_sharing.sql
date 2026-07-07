-- Add sharing support to org_documents
ALTER TABLE org_documents ADD COLUMN IF NOT EXISTS share_token text UNIQUE;
ALTER TABLE org_documents ADD COLUMN IF NOT EXISTS share_access text DEFAULT 'none';

CREATE UNIQUE INDEX IF NOT EXISTS idx_docs_share_token
  ON org_documents(share_token)
  WHERE share_token IS NOT NULL;
