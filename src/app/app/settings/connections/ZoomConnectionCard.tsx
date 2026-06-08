"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ZoomConnectionPublic } from "@/lib/pa-zoom-connections";

function ZoomIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="4" width="9" height="8" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M11 7l4-2v6l-4-2V7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

// The actions this connection authorizes, in plain language for the chip row.
const CAPABILITY_CHIPS = [
  "schedule meetings",
  "reschedule / cancel",
  "read upcoming",
  "grab join links",
];

export default function ZoomConnectionCard({
  connection,
  oauthConfigured,
}: {
  connection: ZoomConnectionPublic | null;
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
      const res = await fetch("/api/connections/zoom/disconnect", {
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
            <ZoomIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">Zoom</p>
            {isActive ? (
              <p className="text-sm text-slate-300 mt-0.5 truncate">
                {connection?.email ?? "Connected account"}
              </p>
            ) : isError ? (
              <p className="text-sm text-amber-400/90 mt-0.5 leading-relaxed">
                Reconnect needed — your Zoom authorization was revoked or expired.
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                Connect your Zoom account so your agent can schedule the video call and drop the join
                link into the calendar invite and your emails. New meetings wait for your approval.
              </p>
            )}
            {isActive && (
              <div className="mt-2 flex flex-wrap gap-1">
                {CAPABILITY_CHIPS.map((c) => (
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
              href="/api/connections/zoom/start"
              className="inline-flex items-center rounded-lg bg-[#22d3ee] px-3.5 py-2 text-xs font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
            >
              {isError ? "Reconnect →" : "Connect with Zoom →"}
            </a>
          ) : (
            <span className="text-[10px] font-mono text-amber-400/80 border border-amber-500/30 rounded px-2 py-1 bg-amber-500/5 text-right leading-snug">
              Add ZOOM_CLIENT_ID
              <br />
              in Vercel
            </span>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-400 pl-7">{error}</p>}
    </div>
  );
}
