"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendlyConnectionPublic } from "@/lib/pa-calendly-connections";

function CalendlyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 5v3l2 1.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The connector's actions as plain-language scope chips (task item 5). Calendly's standard grant
// covers all of these; the gates live at the action layer, so we show what the agent can actually
// do — reads, plus the two approval-gated writes.
const ACTION_CHIPS = [
  "list meeting types",
  "list bookings",
  "see who booked",
  "send booking link (approval)",
  "cancel booking (approval)",
];

export default function CalendlyConnectionCard({
  connection,
  oauthConfigured,
}: {
  connection: CalendlyConnectionPublic | null;
  oauthConfigured: boolean;
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
      const res = await fetch("/api/connections/calendly/disconnect", {
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
            <CalendlyIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">Calendly</p>
            {isActive ? (
              <p className="text-sm text-slate-300 mt-0.5 truncate">
                {connection?.email ?? "Connected account"}
              </p>
            ) : isError ? (
              <p className="text-sm text-amber-400/90 mt-0.5 leading-relaxed">
                Reconnect needed — Calendly authorization expired.
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                Let your agent send prospects a booking link with the right meeting type, and see
                what&apos;s booked. Booking links and cancellations are staged for your approval
                first — nothing reaches a prospect on its own.
              </p>
            )}
            {isActive && (
              <div className="mt-2 flex flex-wrap gap-1">
                {ACTION_CHIPS.map((c) => (
                  <span
                    key={c}
                    className="text-[10px] font-mono text-slate-400 border border-slate-700/60 rounded px-1.5 py-0.5"
                  >
                    {c}
                  </span>
                ))}
              </div>
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
          ) : oauthConfigured ? (
            <a
              href="/api/connections/calendly/start"
              className="inline-flex items-center rounded-lg bg-[#22d3ee] px-3.5 py-2 text-xs font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
            >
              {isError ? "Reconnect →" : "Connect Calendly →"}
            </a>
          ) : (
            <span className="text-[10px] font-mono text-amber-400/80 border border-amber-500/30 rounded px-2 py-1 bg-amber-500/5 text-right leading-snug">
              Configure Calendly
              <br />
              OAuth in Vercel
            </span>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-400 pl-7">{error}</p>}
    </div>
  );
}
