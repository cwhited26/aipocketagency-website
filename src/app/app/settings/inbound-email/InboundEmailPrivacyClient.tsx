"use client";

import { useState } from "react";

// The privacy-review list for one inbound address: last 30 emails received, each with a
// "Purge from brain" button that hard-deletes the capture + its thread-watch.

export type PrivacyEntry = {
  id: string;
  addressKind: "inbound" | "bcc";
  fromAddr: string;
  subject: string | null;
  receivedAt: string;
  brainPath: string | null;
  status: "received" | "reply-sent" | "reply-drafted" | "purged";
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

const STATUS_LABEL: Record<PrivacyEntry["status"], string> = {
  received: "Logged",
  "reply-sent": "Replied",
  "reply-drafted": "Reply drafted",
  purged: "Purged",
};

export default function InboundEmailPrivacyClient({ initial }: { initial: PrivacyEntry[] }) {
  const [entries, setEntries] = useState<PrivacyEntry[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function purge(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/app/settings/inbound-email/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Couldn't purge that entry. Try again.");
        return;
      }
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: "purged", brainPath: null } : e)),
      );
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">Nothing received here yet.</p>;
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {entries.map((e) => (
        <div
          key={e.id}
          className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-4 py-3 flex items-start justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="text-sm text-slate-200 truncate">{e.subject || "(no subject)"}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {e.addressKind === "bcc" ? "To" : "From"} {e.fromAddr} · {relativeTime(e.receivedAt)} ·{" "}
              {STATUS_LABEL[e.status]}
            </p>
          </div>
          {e.status === "purged" ? (
            <span className="text-xs text-slate-600 font-mono shrink-0">purged</span>
          ) : (
            <button
              type="button"
              onClick={() => purge(e.id)}
              disabled={busyId === e.id}
              className="text-xs px-2.5 py-1 rounded-md border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 transition-colors disabled:opacity-50 shrink-0"
            >
              {busyId === e.id ? "Purging…" : "Purge from brain"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
