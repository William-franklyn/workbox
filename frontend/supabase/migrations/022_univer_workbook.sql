-- 022: Univer spreadsheet engine — full workbook snapshot alongside the
-- legacy col_headers/row_data (kept in sync for the agent and previews).
alter table spreadsheets add column if not exists workbook jsonb;
