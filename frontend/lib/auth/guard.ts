import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { validateApiKey } from "@/lib/api-key";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgRole = "owner" | "admin" | "member" | "guest";

export interface AuthContext {
  userId: string;
  orgId: string;
  role: OrgRole;
  /** RLS-scoped client bound to the caller's session (null for API-key auth). */
  supabase: SupabaseClient | null;
  /** Service client — bypasses RLS. Always filter by ctx.orgId when using it. */
  svc: SupabaseClient;
}

/** Discriminated result so routes can do: if ("error" in auth) return auth.error */
export type GuardResult = { ctx: AuthContext } | { error: NextResponse };

function deny(status: number, message: string): { error: NextResponse } {
  return { error: NextResponse.json({ error: message }, { status }) };
}

/**
 * Resolves the caller from either a Supabase session cookie or a `wbx_` API
 * key, loads their profile, and requires an organization.
 *
 * Usage:
 *   const auth = await requireOrg(req);
 *   if ("error" in auth) return auth.error;
 *   const { ctx } = auth; // ctx.orgId, ctx.role, ctx.svc, ctx.supabase
 */
export async function requireOrg(req?: NextRequest): Promise<GuardResult> {
  let userId: string | null = null;
  let supabase: SupabaseClient | null = null;

  const authHeader = req?.headers.get("authorization") ?? null;
  if (authHeader?.startsWith("Bearer wbx_")) {
    userId = await validateApiKey(authHeader);
    if (!userId) return deny(401, "Invalid API key");
  } else {
    supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return deny(401, "Unauthorized");
    userId = user.id;
  }

  const svc = createServiceClient();
  const { data: profile } = await svc
    .from("profiles")
    .select("organization_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.organization_id) return deny(403, "No organization");

  return {
    ctx: {
      userId,
      orgId: profile.organization_id,
      role: (profile.role ?? "member") as OrgRole,
      supabase,
      svc,
    },
  };
}

const ROLE_RANK: Record<OrgRole, number> = { guest: 0, member: 1, admin: 2, owner: 3 };

/** Like requireOrg, but also requires at least the given role. */
export async function requireRole(minRole: OrgRole, req?: NextRequest): Promise<GuardResult> {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth;
  if (ROLE_RANK[auth.ctx.role] < ROLE_RANK[minRole]) {
    return deny(403, `Requires ${minRole} role`);
  }
  return auth;
}

/** Requires owner or admin. */
export function requireAdmin(req?: NextRequest): Promise<GuardResult> {
  return requireRole("admin", req);
}

/**
 * Verifies a space belongs to the caller's org (and, for guests, that they
 * were granted access to it). Use before any service-client space operation.
 */
export async function assertSpaceInOrg(ctx: AuthContext, spaceId: string): Promise<NextResponse | null> {
  const { data: space } = await ctx.svc
    .from("spaces").select("id, org_id").eq("id", spaceId).maybeSingle();
  if (!space || space.org_id !== ctx.orgId) {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }
  if (ctx.role === "guest") {
    const { data: perm } = await ctx.svc
      .from("space_permissions").select("id")
      .eq("space_id", spaceId).eq("user_id", ctx.userId).maybeSingle();
    if (!perm) return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }
  return null;
}

/** Verifies a list belongs to the caller's org. Returns an error response or null. */
export async function assertListInOrg(ctx: AuthContext, listId: string): Promise<NextResponse | null> {
  const { data: list } = await ctx.svc
    .from("lists").select("id, org_id, space_id").eq("id", listId).maybeSingle();
  if (!list || list.org_id !== ctx.orgId) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }
  if (ctx.role === "guest") {
    const { data: perm } = await ctx.svc
      .from("space_permissions").select("id")
      .eq("space_id", list.space_id).eq("user_id", ctx.userId).maybeSingle();
    if (!perm) return NextResponse.json({ error: "List not found" }, { status: 404 });
  }
  return null;
}

/** Verifies a task belongs to the caller's org. Returns an error response or null. */
export async function assertTaskInOrg(ctx: AuthContext, taskId: string): Promise<NextResponse | null> {
  const { data: task } = await ctx.svc
    .from("tasks").select("id, org_id").eq("id", taskId).maybeSingle();
  if (!task || task.org_id !== ctx.orgId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return null;
}

/**
 * Generic org-ownership check for any table with an org column.
 * assertRowInOrg(ctx, "docs", docId) / assertRowInOrg(ctx, "spreadsheets", id, "organization_id")
 */
export async function assertRowInOrg(
  ctx: AuthContext,
  table: string,
  id: string,
  orgColumn: "org_id" | "organization_id" = "org_id",
): Promise<NextResponse | null> {
  const { data: row } = await ctx.svc
    .from(table).select(`id, ${orgColumn}`).eq("id", id).maybeSingle();
  if (!row || (row as Record<string, unknown>)[orgColumn] !== ctx.orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}
