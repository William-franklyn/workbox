"use client";
import { useEffect, useState } from "react";

export interface Member { id: string; full_name: string; role: string; }

// Module-level cache so re-renders don't refetch
let cache: Member[] | null = null;
let fetching = false;
const listeners: Array<(m: Member[]) => void> = [];

function subscribe(fn: (m: Member[]) => void) {
  listeners.push(fn);
  return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); };
}

function notify(m: Member[]) { listeners.forEach((fn) => fn(m)); }

export function useMembers(): Member[] {
  const [members, setMembers] = useState<Member[]>(cache ?? []);

  useEffect(() => {
    const unsub = subscribe(setMembers);
    if (cache) { setMembers(cache); return unsub; }
    if (!fetching) {
      fetching = true;
      fetch("/api/members").then((r) => r.json()).then((d) => {
        const list = Array.isArray(d) ? d : [];
        cache = list;
        notify(list);
      }).catch(() => { fetching = false; });
    }
    return unsub;
  }, []);

  return members;
}

export function getMemberInitials(members: Member[], userId?: string): string {
  if (!userId) return "?";
  const m = members.find((m) => m.id === userId);
  if (!m?.full_name) return "?";
  return m.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function getMemberName(members: Member[], userId?: string): string {
  if (!userId) return "Unassigned";
  const m = members.find((m) => m.id === userId);
  return m?.full_name || "Unknown";
}
