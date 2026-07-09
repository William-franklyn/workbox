-- 019: fixes found during the full-feature walkthrough

-- Spreadsheet creation fails: the live table has folder_id NOT NULL, but the
-- app creates standalone spreadsheets with no folder (migration 014 defines
-- the column as nullable).
alter table spreadsheets alter column folder_id drop not null;

-- Team chat renders new messages via a realtime subscription; the table must
-- be in the realtime publication for INSERT events to be delivered.
do $$ begin
  alter publication supabase_realtime add table team_messages;
exception
  when duplicate_object then null;
  when undefined_table then null;
end $$;
