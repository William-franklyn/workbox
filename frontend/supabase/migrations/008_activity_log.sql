CREATE TABLE IF NOT EXISTS activity_log (
  id text PRIMARY KEY DEFAULT 'al' || extract(epoch from now())::text,
  org_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL, -- 'task', 'doc', 'goal', 'space', 'list'
  entity_id text NOT NULL,
  entity_name text,
  action text NOT NULL, -- 'created', 'updated', 'deleted', 'commented', 'status_changed', 'assigned'
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_org ON activity_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id, created_at DESC);
