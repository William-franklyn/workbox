-- ============================================================
-- 021: Semantic search (pgvector) over docs + knowledge base
-- Run in Supabase SQL editor.
-- ============================================================

create extension if not exists vector;

-- Chunked, embedded copies of searchable content. Rebuilt on every save.
create table if not exists public.doc_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id text,
  source_type text not null check (source_type in ('doc', 'kb')),
  source_id text not null,
  title text,
  chunk_index int not null default 0,
  content text not null,
  embedding vector(384),
  updated_at timestamptz not null default now()
);

create index if not exists doc_chunks_source_idx on public.doc_chunks (source_type, source_id);
create index if not exists doc_chunks_org_idx on public.doc_chunks (org_id);
create index if not exists doc_chunks_embedding_idx
  on public.doc_chunks using hnsw (embedding vector_cosine_ops);

-- Service-role only; the agent and API routes query through the server.
alter table public.doc_chunks enable row level security;

create or replace function public.match_doc_chunks(
  query_embedding vector(384),
  p_org text,
  match_count int default 5
)
returns table (
  source_type text,
  source_id text,
  title text,
  content text,
  similarity float
)
language sql stable as $$
  select
    dc.source_type,
    dc.source_id,
    dc.title,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.doc_chunks dc
  where dc.org_id = p_org
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
