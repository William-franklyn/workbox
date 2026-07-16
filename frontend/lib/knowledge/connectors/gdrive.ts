import { createServiceClient } from "@/lib/supabase/server";
import { getValidToken } from "@/lib/google/calendar";
import { extractText } from "@/lib/knowledge/extract";
import { runIngest } from "@/lib/knowledge/ingest";

/**
 * Google Drive connector (first external connector — docs/knowledge-platform.md).
 *
 * Model: the connecting user's Drive, read-only. Each ingestable Drive file
 * becomes a `knowledge_sources` row (type "connector", origin_id "gdrive:<id>").
 * Sync is incremental — files whose modifiedTime hasn't advanced past the
 * source's last_ingested_at are skipped. Extracted text is stored in raw_text
 * (capped) so re-ingest never needs Drive access again.
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const MAX_FILES_PER_SYNC = 40;
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024; // matches upload cap
const MAX_RAW_TEXT_CHARS = 800_000;

/** Google-native types exported as text; binary types downloaded + extracted. */
const EXPORT_MIME: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.presentation": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
};
const BINARY_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
];

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
}

export async function driveConnected(userId: string): Promise<boolean> {
  const svc = createServiceClient();
  const { data } = await svc.from("user_integrations")
    .select("id").eq("user_id", userId).eq("provider", "google_drive").maybeSingle();
  return Boolean(data);
}

async function listDriveFiles(token: string): Promise<DriveFile[]> {
  const mimeClauses = [...Object.keys(EXPORT_MIME), ...BINARY_MIMES]
    .map((m) => `mimeType='${m}'`).join(" or ");
  const params = new URLSearchParams({
    q: `trashed = false and (${mimeClauses})`,
    fields: "files(id,name,mimeType,modifiedTime,size,webViewLink)",
    orderBy: "modifiedTime desc",
    pageSize: String(MAX_FILES_PER_SYNC),
    // Personal + shared-with-me; shared drives can come later with driveId support.
    spaces: "drive",
  });
  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Drive list failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.files ?? []) as DriveFile[];
}

async function fetchDriveFileText(token: string, file: DriveFile): Promise<string> {
  const exportMime = EXPORT_MIME[file.mimeType];
  const url = exportMime
    ? `${DRIVE_API}/files/${file.id}/export?mimeType=${encodeURIComponent(exportMime)}`
    : `${DRIVE_API}/files/${file.id}?alt=media`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`);

  if (exportMime) return await res.text();
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) throw new Error("File too large (max 20MB)");
  return extractText(buffer, file.name, file.mimeType);
}

export interface DriveSyncResult {
  scanned: number;
  ingested: number;
  skipped: number;
  failed: number;
  errors: Array<{ file: string; error: string }>;
}

/** Sync the connecting user's Drive into the org's knowledge base. */
export async function syncDrive(orgId: string, userId: string): Promise<DriveSyncResult> {
  const svc = createServiceClient();
  const token = await getValidToken(userId, svc, "google_drive");
  if (!token) throw new Error("Google Drive is not connected (or the token expired) — reconnect it");

  const files = await listDriveFiles(token);
  const result: DriveSyncResult = { scanned: files.length, ingested: 0, skipped: 0, failed: 0, errors: [] };

  for (const file of files) {
    const originId = `gdrive:${file.id}`;
    try {
      // Incremental: skip when our last ingest is newer than Drive's modifiedTime.
      const { data: existing } = await svc.from("knowledge_sources")
        .select("id, status, last_ingested_at")
        .eq("org_id", orgId).eq("type", "connector").eq("origin_id", originId)
        .maybeSingle();
      if (
        existing?.status === "ready" &&
        existing.last_ingested_at &&
        new Date(existing.last_ingested_at) >= new Date(file.modifiedTime)
      ) {
        result.skipped++;
        continue;
      }

      const text = (await fetchDriveFileText(token, file)).slice(0, MAX_RAW_TEXT_CHARS);
      const { data: source, error } = await svc.from("knowledge_sources").upsert({
        org_id: orgId,
        created_by: userId,
        type: "connector",
        origin_id: originId,
        title: file.name,
        url: file.webViewLink ?? null,
        mime_type: file.mimeType,
        size_bytes: file.size ? Number(file.size) : null,
        raw_text: text,
        updated_at: new Date().toISOString(),
      }, { onConflict: "org_id,type,origin_id" }).select("id").single();
      if (error || !source) throw new Error(error?.message ?? "Source upsert failed");

      const ingest = await runIngest(source.id);
      if (!ingest.ok) throw new Error(ingest.error);
      result.ingested++;
    } catch (e) {
      result.failed++;
      result.errors.push({ file: file.name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return result;
}
