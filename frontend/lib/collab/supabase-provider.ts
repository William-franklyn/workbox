import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Free Yjs provider over Supabase Realtime broadcast (infra WorkBox already
 * runs). Syncs document + awareness; exposes `.awareness`, a `synced` event,
 * and `destroy()`. Managed by lib/collab/manager for Strict-Mode safety.
 */

function toB64(u8: Uint8Array): string {
  let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}
function fromB64(str: string): Uint8Array {
  const bin = atob(str); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

type Handler = () => void;

export class SupabaseProvider {
  awareness: Awareness;
  synced = false;
  private channel: RealtimeChannel;
  private ready = false;
  private queue: { event: string; u: string }[] = [];
  private handlers: Record<string, Handler[]> = {};

  constructor(private doc: Y.Doc, roomId: string) {
    this.awareness = new Awareness(doc);
    const supabase = createClient();
    this.channel = supabase.channel(`yjs:${roomId}`, { config: { broadcast: { self: false } } });

    doc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);

    this.channel
      .on("broadcast", { event: "update" }, ({ payload }) => Y.applyUpdate(this.doc, fromB64(payload.u), this))
      .on("broadcast", { event: "awareness" }, ({ payload }) => applyAwarenessUpdate(this.awareness, fromB64(payload.u), this))
      .on("broadcast", { event: "sync-request" }, () => {
        this.raw("sync-step", toB64(Y.encodeStateAsUpdate(this.doc)));
        const ids = Array.from(this.awareness.getStates().keys());
        if (ids.length) this.raw("awareness", toB64(encodeAwarenessUpdate(this.awareness, ids)));
      })
      .on("broadcast", { event: "sync-step" }, ({ payload }) => { Y.applyUpdate(this.doc, fromB64(payload.u), this); this.markSynced(); })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.ready = true;
          this.queue.forEach((m) => this.channel.send({ type: "broadcast", event: m.event, payload: { u: m.u } }));
          this.queue = [];
          this.channel.send({ type: "broadcast", event: "sync-request", payload: {} });
          setTimeout(() => this.markSynced(), 900);
        }
      });
  }

  private raw(event: string, u: string) {
    if (this.ready) this.channel.send({ type: "broadcast", event, payload: { u } });
    else this.queue.push({ event, u }); // buffer until the channel is joined
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return;
    this.raw("update", toB64(update));
  };

  private onAwarenessUpdate = (changes: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin === this) return;
    const ids = [...changes.added, ...changes.updated, ...changes.removed];
    this.raw("awareness", toB64(encodeAwarenessUpdate(this.awareness, ids)));
  };

  private markSynced() {
    if (this.synced) return;
    this.synced = true;
    (this.handlers["synced"] ?? []).forEach((f) => f());
  }

  on(ev: string, fn: Handler) { (this.handlers[ev] ??= []).push(fn); }
  off(ev: string, fn: Handler) { this.handlers[ev] = (this.handlers[ev] ?? []).filter((f) => f !== fn); }

  destroy() {
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    removeAwarenessStates(this.awareness, [this.doc.clientID], this);
    this.channel.unsubscribe();
  }
}
