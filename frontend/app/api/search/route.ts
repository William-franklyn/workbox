import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/guard";

export interface SearchResult {
  type: "task" | "doc" | "kb_article" | "document" | "crm_company" | "crm_contact" | "goal" | "spreadsheet";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

/**
 * GET /api/search?q=...
 * Unified full-text search across the org's content, powered by the
 * generated tsvector columns + GIN indexes from migration 017.
 */
export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const svc = ctx.svc;
  const LIMIT = 8;

  // Guests only see tasks in their granted spaces; keep it simple and hide
  // the rest of the modules from them entirely.
  const guestSpaceIds: string[] = [];
  if (ctx.role === "guest") {
    const { data: perms } = await svc
      .from("space_permissions").select("space_id").eq("user_id", ctx.userId);
    guestSpaceIds.push(...(perms ?? []).map(p => p.space_id));
    if (guestSpaceIds.length === 0) return NextResponse.json({ results: [] });
  }

  const searches = [
    (() => {
      let query = svc.from("tasks")
        .select("id, title, status, list_id")
        .eq("org_id", ctx.orgId)
        .textSearch("search_tsv", q, { type: "websearch", config: "simple" })
        .limit(LIMIT);
      if (ctx.role === "guest") query = query.in("space_id", guestSpaceIds);
      return query.then(({ data }) => (data ?? []).map((t): SearchResult => ({
        type: "task", id: t.id, title: t.title,
        subtitle: t.status.replace("_", " "),
        href: `/tasks/${t.list_id}?task=${t.id}`,
      })));
    })(),
    ctx.role === "guest" ? Promise.resolve([]) : svc.from("docs")
      .select("id, title")
      .eq("org_id", ctx.orgId)
      .not("title", "like", "\\_\\_sheet\\_\\_%")
      .textSearch("search_tsv", q, { type: "websearch", config: "simple" })
      .limit(LIMIT)
      .then(({ data }) => (data ?? []).map((d): SearchResult => ({
        type: "doc", id: d.id, title: d.title, href: `/docs/${d.id}`,
      }))),
    ctx.role === "guest" ? Promise.resolve([]) : svc.from("kb_articles")
      .select("id, title, summary")
      .eq("org_id", ctx.orgId)
      .textSearch("search_tsv", q, { type: "websearch", config: "simple" })
      .limit(LIMIT)
      .then(({ data }) => (data ?? []).map((a): SearchResult => ({
        type: "kb_article", id: a.id, title: a.title,
        subtitle: a.summary ?? undefined, href: `/knowledge?article=${a.id}`,
      }))),
    ctx.role === "guest" ? Promise.resolve([]) : svc.from("org_documents")
      .select("id, name, folder")
      .eq("org_id", ctx.orgId)
      .textSearch("search_tsv", q, { type: "websearch", config: "simple" })
      .limit(LIMIT)
      .then(({ data }) => (data ?? []).map((d): SearchResult => ({
        type: "document", id: d.id, title: d.name,
        subtitle: d.folder ?? undefined, href: `/documents?doc=${d.id}`,
      }))),
    ctx.role === "guest" ? Promise.resolve([]) : svc.from("crm_companies")
      .select("id, name, industry")
      .eq("org_id", ctx.orgId)
      .textSearch("search_tsv", q, { type: "websearch", config: "simple" })
      .limit(LIMIT)
      .then(({ data }) => (data ?? []).map((c): SearchResult => ({
        type: "crm_company", id: c.id, title: c.name,
        subtitle: c.industry ?? undefined, href: `/crm?company=${c.id}`,
      }))),
    ctx.role === "guest" ? Promise.resolve([]) : svc.from("crm_contacts")
      .select("id, first_name, last_name, email")
      .eq("org_id", ctx.orgId)
      .textSearch("search_tsv", q, { type: "websearch", config: "simple" })
      .limit(LIMIT)
      .then(({ data }) => (data ?? []).map((c): SearchResult => ({
        type: "crm_contact", id: c.id,
        title: [c.first_name, c.last_name].filter(Boolean).join(" "),
        subtitle: c.email ?? undefined, href: `/crm?contact=${c.id}`,
      }))),
    ctx.role === "guest" ? Promise.resolve([]) : svc.from("goals")
      .select("id, title")
      .eq("org_id", ctx.orgId)
      .textSearch("search_tsv", q, { type: "websearch", config: "simple" })
      .limit(LIMIT)
      .then(({ data }) => (data ?? []).map((g): SearchResult => ({
        type: "goal", id: g.id, title: g.title, href: `/goals?goal=${g.id}`,
      }))),
    ctx.role === "guest" ? Promise.resolve([]) : svc.from("spreadsheets")
      .select("id, name")
      .eq("organization_id", ctx.orgId)
      .textSearch("search_tsv", q, { type: "websearch", config: "simple" })
      .limit(LIMIT)
      .then(({ data }) => (data ?? []).map((s): SearchResult => ({
        type: "spreadsheet", id: s.id, title: s.name, href: `/spreadsheet/${s.id}`,
      }))),
  ];

  const settled = await Promise.allSettled(searches);
  const results = settled
    .flatMap(s => (s.status === "fulfilled" ? s.value : []))
    .slice(0, 40);

  return NextResponse.json({ results });
}
