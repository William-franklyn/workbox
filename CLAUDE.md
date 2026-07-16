# WorkBox — Enterprise Intelligence Platform

WorkBox is pivoting from an all-in-one productivity suite into an **Enterprise Intelligence Platform** — "The AI Operating System for Enterprise." Full strategy: [docs/VISION.md](docs/VISION.md).

Before building any feature, it must pass the five guiding questions:
1. What customer problem does this solve?
2. Why would an organization pay for this?
3. Does it strengthen WorkBox's position as an Enterprise Intelligence Platform?
4. Can competitors easily copy it?
5. Can we measure the business value it delivers?

## Branch workflow

- `product` — the pivot. All Enterprise Intelligence work happens here.
- `main` — stable WorkBox (the existing productivity suite). Hotfixes only.
- Merge `main → product` periodically to limit drift. Never merge `product → main` until the pivot ships.

## Repo map

| Path | What it is |
|---|---|
| `frontend/` | Next.js 16 App Router, React 19, TypeScript, Tailwind v4. Nearly all product code AND the API. |
| `backend/` | Python FastAPI RAG service (ingest + chat). Legacy — being absorbed into `frontend/` during Milestone 1. |
| `extension/` | Chrome MV3 capture extension. Talks to the v1 API. |
| `workbox-mcp/` | MCP server exposing the v1 API to LLM agents. |

## Commands

```bash
cd frontend && npm run dev      # dev server
cd frontend && npm run build    # production build
cd frontend && npx tsc --noEmit # typecheck (CI runs this)
cd backend && uvicorn main:app  # legacy RAG service (port 8000)
```

CI (GitHub Actions): lint (non-blocking) + typecheck + build. There is no test suite yet — verify changes by running the app.

## ⚠️ Next.js version warning

`frontend/` runs Next.js **16.2.9**, which has breaking changes vs. your training data — APIs, conventions, and file structure may differ. Read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing framework-touching code. Heed deprecation notices.

## Architecture conventions

### Auth & multi-tenancy
- Every authed API route resolves the caller via `requireOrg()` in `frontend/lib/auth/guard.ts` → `AuthContext { userId, orgId, role, supabase (RLS-scoped), svc (service-role) }`. Accepts a Supabase session cookie or a `Bearer wbx_...` API key.
- Single org per user: `profiles.organization_id` + `profiles.role`. Roles: `owner | admin | member | guest`. Guests are restricted to granted spaces via `space_permissions`.
- Tenancy is enforced by Postgres RLS — every org table carries `organization_id` policies (pattern: `frontend/supabase/migrations/016_organizations_rbac.sql`). New tables must follow it.

### Database migrations
- Numbered SQL files in `frontend/supabase/migrations/` (currently 000–031; next is `032_*.sql`). Raw SQL, no ORM — the app uses the Supabase JS client directly.

### API surfaces
- **Internal:** `frontend/app/api/*` — session auth, consumed by the app UI.
- **Public v1:** `frontend/app/api/v1/*` — API-key auth, consumed by the Chrome extension and `workbox-mcp`. Treat it as a stable contract; don't break it.

### AI layer
- Agent loop: `frontend/lib/agent-runner.ts` (~25 tools) driven by `frontend/app/api/ai/chat/route.ts`, rate-limited via Upstash.
- Vector search: `doc_chunks` table + `search_chunks` RPC (`frontend/supabase/migrations/021_semantic_search.sql`), pgvector HNSW.
- **Target stack (product branch):** Claude Sonnet for answers/reasoning, Claude Haiku for cheap high-volume tasks, and a 1024+-dim embedding model (Voyage or OpenAI). Groq + HuggingFace MiniLM (384-dim) are legacy and being retired — don't build new features on them.
- **Knowledge platform (new, Milestone 1):** `frontend/lib/knowledge/` (embeddings provider, chunker, extraction, ingest) + `frontend/app/api/knowledge/{sources,search,sync}` over `knowledge_sources` / `ingest_jobs` / `knowledge_chunks` (migration 032, `match_knowledge_chunks` RPC — permission-aware). Requires `VOYAGE_API_KEY` (preferred) or `OPENAI_API_KEY`.
- Every AI answer must show sources/citations, confidence, and why it was generated (see Security UX in VISION.md).

### Frontend patterns
- State: Zustand stores in `frontend/store/` + TanStack React Query for server state.
- Components: shadcn-style in `frontend/components/`, Tailwind v4, lucide-react icons, framer-motion.
- Docs editor is TipTap + Yjs; spreadsheets are Univer.

## Design language

- Dark mode is the default; light mode optional.
- Colors: blue primary, purple accent, green/amber/red semantic, neutral gray backgrounds. AI actions get the gradient accent.
- Minimal, professional, calm — no visual clutter. Skeleton loading, streaming AI responses, optimistic UI.
- Target information architecture: **Home / Knowledge / Agents / Workflows / Insights / Integrations / Admin**. Everything belongs inside one of those.

## Git conventions

- Never add `Co-Authored-By` trailers to commits.
- Conventional-ish commit subjects (`feat:`, `fix:`) matching existing history.
