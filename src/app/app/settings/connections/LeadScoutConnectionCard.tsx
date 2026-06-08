"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LeadScoutConnectionPublic } from "@/lib/pa-lead-scout-connections";

function ScoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10.2 10.2l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function LeadScoutConnectionCard({
  connection,
  sharedEligible,
}: {
  connection: LeadScoutConnectionPublic | null;
  // True for Studio+ / Enterprise — unlocks the "use PA's shared Bright Data account" option.
  sharedEligible: boolean;
}) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [useShared, setUseShared] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = connection?.status === "active";

  async function handleConnect() {
    if (connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/connectors/lead-scout/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useShared ? { useShared: true } : { apiKey: apiKey.trim() }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Couldn't save the connection. Try again.");
        return;
      }
      setApiKey("");
      router.refresh();
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (disconnecting) return;
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/connectors/lead-scout/disconnect", {
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

  const connectedVia = connection?.useShared
    ? "PA's shared Bright Data account"
    : "your Bright Data key";

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`mt-0.5 shrink-0 ${isActive ? "text-[#22d3ee]" : "text-slate-600"}`}>
            <ScoutIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">Lead Scout (Bright Data)</p>
            {isActive ? (
              <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">
                Connected via {connectedVia}. Lead Scout uses it to visit each URL you paste and pull
                back a clean profile.
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                Paste a Bright Data API key so Lead Scout can visit pages and read them — even ones
                that block a plain fetch. Your key, your Bright Data bill.
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 mt-0.5">
          {isActive ? (
            <div className="flex items-center gap-3">
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
            </div>
          ) : null}
        </div>
      </div>

      {!isActive && (
        <div className="mt-4 pl-7 flex flex-col gap-3">
          {!useShared && (
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Bright Data API key"
              aria-label="Bright Data API key"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee]/50 focus:outline-none"
            />
          )}

          {sharedEligible && (
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={useShared}
                onChange={(e) => setUseShared(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 accent-[#22d3ee]"
              />
              Use PA&apos;s shared Bright Data account instead (Studio+).
            </label>
          )}

          <button
            onClick={handleConnect}
            disabled={connecting || (!useShared && !apiKey.trim())}
            className="self-start inline-flex items-center rounded-lg bg-[#22d3ee] px-3.5 py-2 text-xs font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {connecting ? "Connecting…" : "Connect Bright Data →"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400 pl-7">{error}</p>}
    </div>
  );
}
