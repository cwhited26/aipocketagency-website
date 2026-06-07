"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GmailConnectionPublic } from "@/lib/pa-gmail-connections";

function GmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 4L8 9.5 14.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function lastSyncLabel(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "synced just now";
  if (mins < 60) return `synced ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `synced ${hrs}h ago`;
  return `synced ${Math.floor(hrs / 24)}d ago`;
}

export default function GmailConnectionCard({
  connection,
}: {
  connection: GmailConnectionPublic | null;
}) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = connection?.status === "active";
  const isError = connection?.status === "error";

  async function handleDisconnect() {
    if (disconnecting) return;
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/connections/gmail/disconnect", {
        method: "POST",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Disconnect failed. Try again.");
        return;
      }
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`mt-0.5 shrink-0 ${isActive ? "text-[#22d3ee]" : "text-slate-600"}`}>
            <GmailIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">Gmail</p>
            {isActive && connection?.email ? (
              <p className="text-sm text-slate-300 mt-0.5 truncate">{connection.email}</p>
            ) : isError ? (
              <p className="text-sm text-amber-400/90 mt-0.5 leading-relaxed">
                Reconnect needed — Gmail authorization expired.
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                Pull incoming email into your Inbox for triage. Read-access plus archive — never
                sends on its own.
              </p>
            )}
            {isActive && lastSyncLabel(connection?.last_sync_at ?? null) && (
              <p className="text-[11px] text-slate-600 mt-1 font-mono">
                {lastSyncLabel(connection?.last_sync_at ?? null)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 mt-0.5">
          {isActive ? (
            <>
              <span className="text-[10px] font-mono text-[#22d3ee] border border-[#22d3ee]/30 rounded px-2 py-1 bg-[#22d3ee]/5">
                connected
              </span>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-xs text-slate-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </>
          ) : (
            <a
              href="/api/connections/gmail/start"
              className="inline-flex items-center rounded-lg bg-[#22d3ee] px-3.5 py-2 text-xs font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
            >
              {isError ? "Reconnect →" : "Connect Gmail →"}
            </a>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-400 pl-7">{error}</p>}
    </div>
  );
}
