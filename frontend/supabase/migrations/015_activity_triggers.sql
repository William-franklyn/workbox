-- Auto-log task activity via trigger
CREATE OR REPLACE FUNCTION log_task_activity()
RETURNS trigger AS $$
DECLARE
  _org_id text;
BEGIN
  -- Resolve org_id from list → space
  SELECT s.org_id INTO _org_id
  FROM lists l JOIN spaces s ON s.id = l.space_id
  WHERE l.id = COALESCE(NEW.list_id, OLD.list_id)
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (id, user_id, org_id, entity_type, entity_id, entity_name, action)
    VALUES (
      'al' || floor(extract(epoch from clock_timestamp()) * 1000)::text || floor(random()*10000)::text,
      NEW.created_by,
      _org_id,
      'task', NEW.id, NEW.title, 'created'
    ) ON CONFLICT DO NOTHING;

  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO activity_log (id, user_id, org_id, entity_type, entity_id, entity_name, action, old_value, new_value)
    VALUES (
      'al' || floor(extract(epoch from clock_timestamp()) * 1000)::text || floor(random()*10000)::text,
      NEW.created_by,
      _org_id,
      'task', NEW.id, NEW.title, 'status_changed',
      to_jsonb(OLD.status), to_jsonb(NEW.status)
    ) ON CONFLICT DO NOTHING;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (id, user_id, org_id, entity_type, entity_id, entity_name, action)
    VALUES (
      'al' || floor(extract(epoch from clock_timestamp()) * 1000)::text || floor(random()*10000)::text,
      OLD.created_by,
      _org_id,
      'task', OLD.id, OLD.title, 'deleted'
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS task_activity_trigger ON tasks;
CREATE TRIGGER task_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_activity();


-- Auto-log doc activity via trigger
CREATE OR REPLACE FUNCTION log_doc_activity()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.title NOT LIKE '__sheet__%' THEN
    INSERT INTO activity_log (id, user_id, org_id, entity_type, entity_id, entity_name, action)
    VALUES (
      'al' || floor(extract(epoch from clock_timestamp()) * 1000)::text || floor(random()*10000)::text,
      NEW.created_by,
      NEW.org_id,
      'doc', NEW.id, NEW.title, 'created'
    ) ON CONFLICT DO NOTHING;

  ELSIF TG_OP = 'DELETE' AND OLD.title NOT LIKE '__sheet__%' THEN
    INSERT INTO activity_log (id, user_id, org_id, entity_type, entity_id, entity_name, action)
    VALUES (
      'al' || floor(extract(epoch from clock_timestamp()) * 1000)::text || floor(random()*10000)::text,
      OLD.created_by,
      OLD.org_id,
      'doc', OLD.id, OLD.title, 'deleted'
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS doc_activity_trigger ON docs;
CREATE TRIGGER doc_activity_trigger
  AFTER INSERT OR DELETE ON docs
  FOR EACH ROW EXECUTE FUNCTION log_doc_activity();


-- Auto-log goal activity via trigger
CREATE OR REPLACE FUNCTION log_goal_activity()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (id, user_id, org_id, entity_type, entity_id, entity_name, action)
    VALUES (
      'al' || floor(extract(epoch from clock_timestamp()) * 1000)::text || floor(random()*10000)::text,
      NEW.created_by,
      NEW.org_id,
      'goal', NEW.id, NEW.title, 'created'
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS goal_activity_trigger ON goals;
CREATE TRIGGER goal_activity_trigger
  AFTER INSERT ON goals
  FOR EACH ROW EXECUTE FUNCTION log_goal_activity();


-- Auto-log space (member joins workspace) activity
CREATE OR REPLACE FUNCTION log_space_activity()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (id, org_id, entity_type, entity_id, entity_name, action)
    VALUES (
      'al' || floor(extract(epoch from clock_timestamp()) * 1000)::text || floor(random()*10000)::text,
      NEW.org_id,
      'space', NEW.id, NEW.name, 'created'
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS space_activity_trigger ON spaces;
CREATE TRIGGER space_activity_trigger
  AFTER INSERT ON spaces
  FOR EACH ROW EXECUTE FUNCTION log_space_activity();
