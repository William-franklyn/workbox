-- ============================================================
-- 033: Upgrade match_knowledge_chunks — also return origin_id + url
-- so callers (agent tool, v1 search, ask UI) can link back to the
-- source. Return type changes, so drop + recreate.
--
-- SAFE TO RUN ANYTIME: nothing on `main` (the portfolio WorkBox
-- deployment) calls this function. The destructive retirement of the
-- legacy doc_chunks pipeline lives in 034 — deliberately separate,
-- because `main` still depends on doc_chunks. See 034's header.
-- Run in Supabase SQL editor.
-- ============================================================

drop function if exists public.match_knowledge_chunks(vector(1024), text, uuid, text, int);

create function public.match_knowledge_chunks(
  query_embedding vector(1024),
  p_org text,
  p_user uuid,
  p_role text,
  match_count int default 8
)
returns table (
  source_id uuid,
  source_type text,
  origin_id text,
  url text,
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
    ks.origin_id,
    ks.url,
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
