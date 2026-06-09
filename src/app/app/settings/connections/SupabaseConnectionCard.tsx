"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseConnectionPublic } from "@/lib/pa-supabase-connections";

function SupabaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M9 1.5L3 9.2c-.3.4 0 1 .5 1H7v4.3c0 .6.8.9 1.1.4L14 7.2c.3-.4 0-1-.5-1H10V1.9c0-.6-.7-.9-1-.4z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SupabaseConnectionCard({
  connection,
}: {
  connection: SupabaseConnectionPublic | null;
}) {
  const router = useRouter();
  const [pat, setPat] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = connection?.status === "active";
  const isError = connection?.status === "error";

  async function handleConnect() {
    if (connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/connectors/supabase/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pat: pat.trim() }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Couldn't save the token. Try again.");
        return;
      }
      setPat("");
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
      const res = await fetch("/api/connectors/supabase/disconnect", {
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
          <span className={`mt-0.5 shrink-0 ${isActive ? "text-[#3ecf8e]" : "text-slate-600"}`}>
            <SupabaseIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">Supabase</p>
            {isActive ? (
              <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">
                Connected{connection?.orgName ? ` to ${connection.orgName}` : ""}. Your agent can
                provision databases, apply migrations, and seed data — each change waits for your
                approval first.
              </p>
            ) : isError ? (
              <p className="text-sm text-amber-400/80 mt-0.5 leading-relaxed">
                Your Supabase access token was rejected. Generate a new one and paste it again.
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                Paste a Supabase access token so your agent can build on your own Supabase — create
                projects, run migrations, and read your data. Your token, your Supabase bill.
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 mt-0.5">
          {isActive ? (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-[#3ecf8e] border border-[#3ecf8e]/30 rounded px-2 py-1 bg-[#3ecf8e]/5">
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
          <input
            type="password"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder="Supabase access token (sbp_…)"
            aria-label="Supabase personal access token"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#3ecf8e]/50 focus:outline-none"
          />
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Generate one at{" "}
            <a
              href="https://supabase.com/dashboard/account/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 underline hover:text-[#3ecf8e]"
            >
              supabase.com/dashboard/account/tokens
            </a>
            . It&apos;s stored encrypted and never shown again.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting || pat.trim().length < 20}
            className="self-start inline-flex items-center rounded-lg bg-[#3ecf8e] px-3.5 py-2 text-xs font-semibold text-[#04231a] hover:bg-[#34b87c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {connecting ? "Connecting…" : "Connect Supabase →"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400 pl-7">{error}</p>}
    </div>
  );
}
