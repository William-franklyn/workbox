-- ============================================================
-- 034: Drop the legacy 384-dim RAG pipeline (doc_chunks +
-- match_doc_chunks, from migration 021). Nothing in this repo
-- uses them — all retrieval goes through knowledge_chunks.
--
-- Sphynx's database is a schema clone of the original WorkBox
-- project, so these objects came along in the dump. Safe to run
-- here anytime. (In the ORIGINAL WorkBox database — now owned by
-- the workmate portfolio deployment — this must NOT be run; that
-- app still uses doc_chunks.)
-- Run in Supabase SQL editor.
-- ============================================================

drop function if exists public.match_doc_chunks(vector(384), text, int);
drop table if exists public.doc_chunks;
