-- ============================================================
-- 032: Knowledge platform — sources, ingest jobs, 1024-dim chunks,
--      permission-aware semantic search (Milestone 1 of the pivot).
-- Supersedes the doc_chunks pipeline from 021 (kept until the ask
-- path is switched over, then dropped in a later migration).
-- Run in Supabase SQL editor.
-- ============================================================

create extension if not exists vector;

-- One row per ingestable thing: an uploaded file, an internal doc/KB
-- article, a browser capture, or (later) a connector item.
create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  created_by uuid,
  type text not null check (type in ('file', 'doc', 'kb', 'capture', 'text', 'url', 'connector')),
  title text not null default '',
  origin_id text,                -- id in the origin system (docs.id, kb_articles.id, drive file id, ...)
  storage_path text,             -- uploaded files: path in the `documents` bucket
  url text,
  mime_type text,
  size_bytes bigint,
  raw_text text,                 -- small inline sources (text/capture) keep their content here
  -- ACL anchor: null = visible to all non-guest org members; a space id
  -- restricts visibility to that space (guests only ever see granted spaces).
  space_id text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  error text,
  chunk_count int not null default 0,
  last_ingested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_sources_org_idx on public.knowledge_sources (org_id);
-- Internal content syncs upsert on (org, type, origin) so re-syncs don't
-- duplicate. Not partial: ON CONFLICT can't infer partial indexes, and nulls
-- are distinct here so file sources (origin_id null) never collide.
create unique index if not exists knowledge_sources_origin_idx
  on public.knowledge_sources (org_id, type, origin_id);

-- Ingestion runs, for observability and (later) background retries.
create table if not exists public.ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  source_id uuid not null references public.knowledge_sources (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error')),
  error text,
  stats jsonb not null default '{}'::jsonb,   -- { chars, chunks, embed_ms, ... }
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists ingest_jobs_source_idx on public.ingest_jobs (source_id);
create index if not exists ingest_jobs_org_idx on public.ingest_jobs (org_id);

-- Embedded chunks. 1024 dims (Voyage voyage-3.5 / OpenAI text-embedding-3-small
-- with dimensions=1024). Rebuilt atomically per source on every ingest.
create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  source_id uuid not null references public.knowledge_sources (id) on delete cascade,
  chunk_index int not null default 0,
  title text,
  content text not null,
  embedding vector(1024),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_source_idx on public.knowledge_chunks (source_id);
create index if not exists knowledge_chunks_org_idx on public.knowledge_chunks (org_id);
create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding vector_cosine_ops);

-- Service-role only (same posture as doc_chunks): all access goes through
-- API routes, which enforce org + role. RLS enabled with no policies.
alter table public.knowledge_sources enable row level security;
alter table public.ingest_jobs enable row level security;
alter table public.knowledge_chunks enable row level security;

-- Permission-aware kNN. Non-guests see every source in their org; guests see
-- only sources anchored to a space they were granted via space_permissions
-- (org-wide sources — space_id null — are hidden from guests).
create or replace function public.match_knowledge_chunks(
  query_embedding vector(1024),
  p_org text,
  p_user uuid,
  p_role text,
  match_count int default 8
)
returns table (
  source_id uuid,
  source_type text,
  title text,
  content text,
  chunk_index int,
  space_id text,
  similarity float
)
language sql stable as $$
  select
    ks.id as source_id,
    ks.type as source_type,
    coalesce(kc.title, ks.title) as title,
    kc.content,
    kc.chunk_index,
    ks.space_id,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  join public.knowledge_sources ks on ks.id = kc.source_id
  where kc.org_id = p_org
    and kc.embedding is not null
    and ks.status = 'ready'
    and (
      p_role is distinct from 'guest'
      or exists (
        select 1 from public.space_permissions sp
        where sp.user_id = p_user and sp.space_id = ks.space_id
      )
    )
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;
