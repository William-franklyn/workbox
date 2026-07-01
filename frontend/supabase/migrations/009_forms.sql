CREATE TABLE IF NOT EXISTS forms (
  id text PRIMARY KEY DEFAULT 'frm' || extract(epoch from now())::text || floor(random()*1000)::text,
  name text NOT NULL DEFAULT 'Untitled Form',
  description text,
  org_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_list_id text REFERENCES lists(id) ON DELETE SET NULL,
  default_status text DEFAULT 'todo',
  default_priority text DEFAULT 'normal',
  fields jsonb DEFAULT '[]',
  submissions_count int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS form_submissions (
  id text PRIMARY KEY DEFAULT 'fsub' || extract(epoch from now())::text || floor(random()*1000)::text,
  form_id text NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}',
  task_id text REFERENCES tasks(id) ON DELETE SET NULL,
  submitter_email text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forms_org ON forms(org_id);
CREATE INDEX IF NOT EXISTS idx_form_subs_form ON form_submissions(form_id, created_at DESC);
