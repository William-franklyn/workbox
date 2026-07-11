import * as Y from "yjs";
import { SupabaseProvider } from "./supabase-provider";

/**
 * Ref-counted registry of collaboration sessions, keyed by document id.
 * Survives React Strict Mode's mount→cleanup→mount cycle (which would
 * otherwise destroy the realtime channel on the throwaway first mount and
 * leave it CLOSED): release() defers teardown, and a re-acquire cancels it.
 */

interface Session { ydoc: Y.Doc; provider: SupabaseProvider; refs: number; killTimer: ReturnType<typeof setTimeout> | null; }

const sessions = new Map<string, Session>();

export function acquireCollab(docId: string): { ydoc: Y.Doc; provider: SupabaseProvider } {
  let s = sessions.get(docId);
  if (s) {
    if (s.killTimer) { clearTimeout(s.killTimer); s.killTimer = null; }
    s.refs++;
  } else {
    const ydoc = new Y.Doc();
    const provider = new SupabaseProvider(ydoc, docId);
    s = { ydoc, provider, refs: 1, killTimer: null };
    sessions.set(docId, s);
  }
  return { ydoc: s.ydoc, provider: s.provider };
}

export function releaseCollab(docId: string) {
  const s = sessions.get(docId);
  if (!s) return;
  s.refs--;
  if (s.refs <= 0 && !s.killTimer) {
    // Defer teardown so a Strict-Mode remount (which re-acquires immediately)
    // keeps the same live session instead of reconnecting.
    s.killTimer = setTimeout(() => {
      s!.provider.destroy();
      s!.ydoc.destroy();
      sessions.delete(docId);
    }, 2500);
  }
}
