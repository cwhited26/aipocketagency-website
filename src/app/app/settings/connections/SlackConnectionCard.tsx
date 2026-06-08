"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SlackConnectionPublic } from "@/lib/pa-slack-connections";

function SlackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <rect x="6.5" y="1.5" width="3" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="6.5" y="6.5" width="8" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1.5" y="6.5" width="3" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1.5" y="6.5" width="8" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

// Short, human label for a granted scope (drops the noise so the chip row reads).
function scopeLabel(scope: string): string {
  return scope.replace(/^chat:write\.public$/, "post to public channels")
    .replace(/^chat:write\.customize$/, "custom post identity")
    .replace(/^chat:write$/, "post messages")
    .replace(/^im:write$/, "open DMs")
    .replace(/^channels:read$/, "list channels")
    .replace(/^channels:history$/, "read channel history")
    .replace(/^groups:read$/, "list private channels")
    .replace(/^groups:history$/, "read private history")
    .replace(/^im:read$/, "list DMs")
    .replace(/^im:history$/, "read DM history")
    .replace(/^users:read$/, "read users");
}

export default function SlackConnectionCard({
  connection,
  oauthConfigured,
}: {
  connection: SlackConnectionPublic | null;
  oauthConfigured: boolean;
}) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = connection?.status === "active";
  const isError = connection?.status === "error";
  const scopes = connection?.scopes ?? [];

  async function handleDisconnect() {
    if (disconnecting) return;
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/connections/slack/disconnect", {
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
            <SlackIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">Slack</p>
            {isActive ? (
              <p className="text-sm text-slate-300 mt-0.5 truncate">
                {connection?.workspace ?? "Connected workspace"}
              </p>
            ) : isError ? (
              <p className="text-sm text-amber-400/90 mt-0.5 leading-relaxed">
                Reconnect needed — Slack authorization was revoked or expired.
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                Let your agent post, reply in threads, and DM — every send is drafted for your
                approval first.
              </p>
            )}
            {isActive && scopes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {scopes.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] font-mono text-slate-400 border border-slate-700/60 rounded px-1.5 py-0.5"
                  >
                    {scopeLabel(s)}
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
              href="/api/connections/slack/start"
              className="inline-flex items-center rounded-lg bg-[#22d3ee] px-3.5 py-2 text-xs font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
            >
              {isError ? "Reconnect →" : "Connect Slack →"}
            </a>
          ) : (
            <span className="text-[10px] font-mono text-amber-400/80 border border-amber-500/30 rounded px-2 py-1 bg-amber-500/5 text-right leading-snug">
              Configure Slack
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
