# Knowledge Platform — Developer Guide

> Audience: engineers joining the project who need to understand, operate, or extend the Enterprise Knowledge system (Milestone 1 of the pivot — see [VISION.md](VISION.md)). Everything described here lives on the `product` branch.

## What it is

The knowledge platform turns an organization's content — uploaded files, internal WorkBox docs, KB articles, browser captures, and (later) external connectors — into a **permission-aware, semantically searchable knowledge base** that an AI can answer questions from **with citations**.

It replaces the legacy RAG pipeline (`frontend/lib/embeddings.ts` + `doc_chunks` + the Python `backend/` service), which still runs for the old agent tool but receives no new features and will be removed once the agent is switched over.

## Architecture at a glance

```
                 ┌────────────────────────────────────────────────────┐
 upload/sync ──► │ knowledge_sources (1 row per document, ACL anchor) │
                 └───────────────┬────────────────────────────────────┘
                                 │ runIngest(sourceId)      writes ingest_jobs row per run
                                 ▼
     resolve text (extract.ts) → chunk (chunker.ts) → embed (embeddings.ts, 1024-dim)
                                 │
                                 ▼
                 ┌────────────────────────────────────────────────────┐
                 │ knowledge_chunks  (pgvector 1024, HNSW cosine)     │
                 └───────────────┬────────────────────────────────────┘
                                 │ match_knowledge_chunks RPC (org + role/space ACL)
                                 ▼
        GET /api/knowledge/search  ──► ranked chunks
        POST /api/knowledge/ask    ──► Claude Sonnet answer, streamed, with citations
```

## Data model

Migration: [`frontend/supabase/migrations/032_knowledge_platform.sql`](../frontend/supabase/migrations/032_knowledge_platform.sql). All `org_id`/`space_id` columns are `text` (matches the pre-existing schema).

| Table | Purpose | Key columns |
|---|---|---|
| `knowledge_sources` | One row per ingestable thing | `type` (`file`, `doc`, `kb`, `capture`, `text`, `url`, `connector`), `origin_id` (id in the origin system; unique per `(org_id, type, origin_id)` so syncs upsert), `storage_path` (uploaded files), `raw_text` (small inline sources), `space_id` (**ACL anchor** — null = org-wide), `status` (`pending → processing → ready | error`), `chunk_count`, `error` |
| `ingest_jobs` | One row per ingestion run (observability, future retries) | `source_id`, `status`, `error`, `stats` jsonb (`{chars, chunks, ms}`) |
| `knowledge_chunks` | Embedded chunks, rebuilt atomically per source on each ingest | `source_id` (FK cascade), `chunk_index`, `content` (title-prefixed), `embedding vector(1024)` with HNSW cosine index |

**RLS posture:** all three tables have RLS enabled with *no* policies — service-role only, same as the legacy `doc_chunks`. Every access goes through API routes, which enforce org + role. Do not query these tables from an RLS-scoped client.

## The permission model (the load-bearing part)

Permission filtering happens **inside the database**, in the `match_knowledge_chunks` RPC — not in application code after retrieval. This is the enterprise differentiator: a guest can never even retrieve a chunk they shouldn't see.

- **Owner / admin / member:** see every `ready` source in their org.
- **Guest:** sees only sources whose `space_id` is in their `space_permissions` grants. Org-wide sources (`space_id IS NULL`) are **hidden** from guests — conservative by design.

The RPC signature: `match_knowledge_chunks(query_embedding vector(1024), p_org text, p_user uuid, p_role text, match_count int)`. Callers pass the caller's identity from `AuthContext`; never call it with elevated/forged role values.

The same guest rule is re-implemented in application code where lists are served without the RPC (`GET /api/knowledge/sources`) — if you change the rule, change it in **both** places.

## Pipeline internals (`frontend/lib/knowledge/`)

| File | What it does | Notes for modification |
|---|---|---|
| `embeddings.ts` | Provider-agnostic embedding: Voyage `voyage-3.5` (preferred, `VOYAGE_API_KEY`) or OpenAI `text-embedding-3-small` (`OPENAI_API_KEY`), both pinned to **1024 dims** (`EMBEDDING_DIMS`). Batches of 96. **Throws** `EmbeddingsError` — unlike the legacy lib, failures are not swallowed. | Changing dims requires a migration of `knowledge_chunks.embedding` and a full re-ingest. Keep `input_type`/`purpose` split: documents embed as `document`, queries as `query` (matters for Voyage). |
| `chunker.ts` | Structure-aware chunking: splits on markdown headings + blank lines, packs to ~1600 chars with 200-char tail overlap, merges trailing fragments < 200 chars, hard-wraps pathological unbroken text. Prefixes every chunk with the document title so context survives into the embedding. | Behavioral tests were run for boundaries/overlap/empty/huge inputs — if you touch this, re-test those cases (there's no committed test suite yet). |
| `extract.ts` | File → text. PDF via `unpdf` (serverless-friendly pdfjs), DOCX via `mammoth`, HTML stripped natively, plain text/markdown/CSV/JSON decoded directly. `extractableType()` gates uploads. | To support a new file type: add extraction here + extend `extractableType`. Dynamic imports keep heavy deps out of unrelated routes. |
| `ingest.ts` | The engine. `runIngest(sourceId)`: load source → create `ingest_jobs` row → resolve text by `type` (file downloads from the `documents` storage bucket; `doc`/`kb` re-read the origin row; `text`/`capture`/`url` use `raw_text`) → chunk → embed → delete old chunks → insert new (batches of 200) → mark source `ready` (or `error` with message). Also `searchKnowledge()` (embed query + RPC) and the `STORAGE_BUCKET` constant. | Synchronous by design — request paths await it (`maxDuration` raised on those routes). For large-scale connector syncs, call `runIngest` from a background job instead; the `ingest_jobs` table is already shaped for that. |
| `ask.ts` | Prompt assembly for the ask endpoint: `ASK_SYSTEM_PROMPT` (answer only from sources, cite `[n]`, admit gaps), `buildAskContext()` (collapses chunk matches to one citation number per source document), `retrievalConfidence()` (similarity heuristic: ≥0.72 high, ≥0.55 medium — **tune against real data**, and note it measures retrieval strength, not answer correctness). | Model is `claude-sonnet-5` via the official `@anthropic-ai/sdk` (`ASK_MODEL`). The legacy agent still uses raw fetch + Haiku — new AI features should use the SDK like this file does. |

## API surface (all under `frontend/app/api/knowledge/`)

All routes authenticate via `requireOrg()` ([`frontend/lib/auth/guard.ts`](../frontend/lib/auth/guard.ts)) — session cookie **or** `wbx_` API key both work. Guests are read-only (and space-filtered); writes require member+; `sync` requires admin.

| Route | Method | Behavior |
|---|---|---|
| `/api/knowledge/sources` | GET | List org sources (guests: space-filtered). Also returns `embeddings_configured` so the UI can show setup state. |
| `/api/knowledge/sources` | POST (multipart) | Upload a file (≤ 20MB, `extractableType` gated, optional `spaceId` form field for ACL scoping) → store in `documents` bucket under `knowledge/{orgId}/{sourceId}/` → ingest inline → return source + ingest result. `502` if ingestion failed (source row remains in `error` state for retry). |
| `/api/knowledge/sources` | POST (json) | Inline text source: `{ title, content, spaceId?, url? }` → stored in `raw_text`, ingested inline. |
| `/api/knowledge/sources/[id]` | GET | Source detail + last 5 ingest jobs. |
| `/api/knowledge/sources/[id]` | POST | Re-ingest (e.g. after an embedding-provider fix). |
| `/api/knowledge/sources/[id]` | DELETE | Remove storage object + row; chunks/jobs cascade. |
| `/api/knowledge/sync` | POST | Admin-only backfill of existing WorkBox content. Body `{ types?: ["doc","kb"] }`. Upserts `knowledge_sources` on `(org_id, type, origin_id)` — idempotent, re-running refreshes. Capped at 100 per type per run; response says when to run again. |
| `/api/knowledge/search` | GET | `?q=&k=` (k ≤ 20). Permission-aware semantic search; returns ranked chunks with similarity. |
| `/api/knowledge/ask` | POST | `{ question, }` → **SSE stream**. Rate-limited (tier `ai`, 20/min/user). Event order: `{type:"sources", sources, confidence}` first (each source: `index`, `source_id`, `title`, `source_type`, `similarity`), then `{type:"delta", text}` tokens, then `{type:"done", model, usage}` (or `{type:"error"}`). Zero retrieval short-circuits without calling Claude. Answers cite sources as `[n]` matching the sources event. |

### Consuming the ask stream (frontend reference)

```ts
const res = await fetch("/api/knowledge/ask", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question }),
});
const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buf = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  for (const line of buf.split("\n\n")) {
    if (!line.startsWith("data: ")) continue;
    const evt = JSON.parse(line.slice(6));
    // evt.type: "sources" | "delta" | "done" | "error"
  }
  buf = buf.slice(buf.lastIndexOf("\n\n") + 2);
}
```

## Configuration

| Env var | Required for | Notes |
|---|---|---|
| `VOYAGE_API_KEY` | Ingestion + search + ask | Preferred provider (voyage-3.5). Wins if both are set. |
| `OPENAI_API_KEY` | (alternative to above) | text-embedding-3-small at `dimensions: 1024`. |
| `ANTHROPIC_API_KEY` | `/api/knowledge/ask` only | Already used by the legacy agent — usually configured. |
| Upstash Redis vars | Rate limiting on ask | Existing setup; without Redis, rate limiting silently allows all. |

Routes return a clear `503` naming the missing key rather than failing deep in the pipeline.

## Operations runbook

**Apply the migration:** run `032_knowledge_platform.sql` in the Supabase SQL editor (same manual process as all prior migrations). Safe to re-run (`if not exists` throughout).

**Smoke test (end to end):**
1. `npm run dev` in `frontend/`, sign in.
2. Upload: `POST /api/knowledge/sources` multipart with a real PDF → expect `201`, source `status: "ready"`, `chunk_count > 0`.
3. Search: `GET /api/knowledge/search?q=<something in the PDF>` → expect the chunk with sensible similarity.
4. Ask: `POST /api/knowledge/ask` with a question the PDF answers → expect sources event, streamed cited answer, done event.
5. ACL: create a guest user without space grants → search/ask must return nothing from org-wide sources.

**Diagnosing a failed ingest:** `GET /api/knowledge/sources/{id}` — the source row carries `error`, and `jobs[]` has per-run `stats`/`error`. Common causes: missing embedding key (503 at upload time), unsupported/corrupt file (`ExtractError`), embedding API 4xx (message includes provider response). Fix, then `POST /api/knowledge/sources/{id}` to re-ingest.

**Cost notes:** embeddings are ~$0.06/M tokens (Voyage); a 100-page PDF is typically < $0.01. Ask calls are Sonnet-priced; retrieval is capped at 12 chunks (~5K tokens of context) and `max_tokens: 16000` (shared between the model's adaptive thinking and the answer).

## Extending the platform

**New file type:** add extraction in `extract.ts` + allow it in `extractableType()`. Nothing else changes.

**New internal content type (e.g. meetings, tasks):** add a `case` to `resolveText()` in `ingest.ts`, allow the `type` in the migration's check constraint (new migration: `alter table … drop constraint …; add constraint … check (type in (…))`), and add the fetch loop to `/api/knowledge/sync`.

**External connector (e.g. Google Drive — planned next):**
1. OAuth + change detection live in the connector; each remote file becomes a `knowledge_sources` row with `type: 'connector'`, `origin_id` = remote file id, and downloaded content stored via `storage_path` or `raw_text`.
2. Run `runIngest` per item from a background path (cron route or queue), not the request path — `ingest_jobs` already records per-run state for retries.
3. Map the connector's sharing model onto `space_id` (or extend the ACL — see below).

**Richer ACLs (per-document permissions from connectors):** today the anchor is one nullable `space_id`. When connectors bring per-user document ACLs, add an ACL table keyed by `source_id` and extend the `where` clause in `match_knowledge_chunks` — keep enforcement in the RPC, and keep the guest default conservative.

**Live re-indexing for docs/KB edits:** the legacy pipeline reindexes on every save (`reindexSource` calls in `app/api/docs/route.ts`, `app/api/knowledge/route.ts`, `lib/agent-runner.ts`). The new pipeline currently relies on `/api/knowledge/sync`. When switching over: replace those call sites with an upsert + `runIngest` (fire-and-forget), then drop `lib/embeddings.ts`, the `doc_chunks` table, and the Python `backend/`.

## Design decisions (why it is the way it is)

- **1024 dims, provider-agnostic:** both Voyage and OpenAI can emit 1024-dim vectors, so the schema doesn't marry a vendor. MiniLM (384-dim, legacy) was demo-grade retrieval.
- **Permission filtering in SQL, not app code:** an ACL bug in post-filtering leaks data silently; a `where` clause in the RPC fails closed.
- **Errors surface, don't swallow:** the legacy pipeline was fire-and-forget (embedding failures silently produced un-searchable docs). Enterprise buyers need to see "this document failed to index and here's why".
- **Sources numbered per document, not per chunk:** citations like [1][2] must map to things a user can open, not to invisible chunk boundaries.
- **Synchronous ingest for now:** simplest thing that works at current scale (uploads ≤ 20MB, sync capped at 100/run). The `ingest_jobs` table exists so moving to background workers is additive, not a rewrite.
- **No-retrieval short-circuit in ask:** answering "nothing found" without an LLM call is cheaper, faster, and can't hallucinate.
