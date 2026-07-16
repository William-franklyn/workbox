-- ============================================================
-- 034: ⚠️  DO NOT RUN while the portfolio WorkBox deployment lives. ⚠️
--
-- Drops the legacy 384-dim RAG pipeline (doc_chunks + match_doc_chunks,
-- from migration 021). The `product` branch stopped using it entirely,
-- BUT the `main` branch — deployed as the original-WorkBox portfolio
-- project — still reads and writes doc_chunks for its agent knowledge
-- search and /api/v1/search. Both branches share this database.
--
-- Run this only when one of these becomes true:
--   a) the portfolio deployment is retired or moved to its own
--      database (pg_dump/restore clone), or
--   b) main is updated to the new knowledge pipeline.
--
-- Until then the only cost of keeping doc_chunks is a little storage.
-- ============================================================

drop function if exists public.match_doc_chunks(vector(384), text, int);
drop table if exists public.doc_chunks;
