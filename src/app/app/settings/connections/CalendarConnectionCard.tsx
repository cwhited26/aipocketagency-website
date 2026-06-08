"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarConnectionPublic } from "@/lib/pa-calendar-connections";

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 6h12" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 1.5v2M11 1.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// Human label for the calendar scopes actually granted (task item 3: "show the active scopes").
function scopeLabels(scopes: string[] | null): string[] {
  if (!scopes) return [];
  const labels: string[] = [];
  if (scopes.includes("https://www.googleapis.com/auth/calendar.events")) {
    labels.push("Read + write events");
  }
  if (scopes.includes("email") || scopes.includes("openid")) {
    labels.push("Account identity");
  }
  return labels;
}

export default function CalendarConnectionCard({
  connection,
}: {
  connection: CalendarConnectionPublic | null;
}) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = connection?.status === "active";
  const isError = connection?.status === "error";
  const scopes = scopeLabels(connection?.scopes ?? null);

  async function handleDisconnect() {
    if (disconnecting) return;
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/connections/calendar/disconnect", {
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
            <CalendarIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">Google Calendar</p>
            {isActive && connection?.email ? (
              <p className="text-sm text-slate-300 mt-0.5 truncate">{connection.email}</p>
            ) : isError ? (
              <p className="text-sm text-amber-400/90 mt-0.5 leading-relaxed">
                Reconnect needed — Calendar authorization expired.
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                Let your agent schedule, reschedule, and propose meeting times. Every write is
                staged for your approval first — nothing hits your calendar on its own.
              </p>
            )}
            {isActive && scopes.length > 0 && (
              <p className="text-[11px] text-slate-600 mt-1.5 font-mono">{scopes.join(" · ")}</p>
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
              href="/api/connections/calendar/start"
              className="inline-flex items-center rounded-lg bg-[#22d3ee] px-3.5 py-2 text-xs font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
            >
              {isError ? "Reconnect →" : "Connect Calendar →"}
            </a>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-400 pl-7">{error}</p>}
    </div>
  );
}
