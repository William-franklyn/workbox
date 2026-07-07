-- Dedicated spreadsheets table for the grid editor
CREATE TABLE IF NOT EXISTS spreadsheets (
  id text PRIMARY KEY,
  organization_id text,
  folder_id text,
  name text NOT NULL DEFAULT 'Untitled Spreadsheet',
  col_headers text[] NOT NULL DEFAULT ARRAY['A','B','C','D','E'],
  row_data jsonb NOT NULL DEFAULT '[]',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spreadsheets_org ON spreadsheets(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_spreadsheets_folder ON spreadsheets(folder_id);
