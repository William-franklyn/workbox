CREATE TABLE IF NOT EXISTS task_dependencies (
  id text PRIMARY KEY DEFAULT 'td' || extract(epoch from now())::text,
  task_id text NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id text NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, depends_on_id),
  CHECK (task_id != depends_on_id)
);
CREATE INDEX IF NOT EXISTS idx_task_dep_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dep_on ON task_dependencies(depends_on_id);
