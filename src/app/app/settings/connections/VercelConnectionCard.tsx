"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VercelConnectionPublic } from "@/lib/pa-vercel-connections";

function VercelIcon() {
  // Vercel's triangle mark.
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.5L14 13H2L8 2.5z" fill="currentColor" />
    </svg>
  );
}

export default function VercelConnectionCard({
  connection,
}: {
  connection: VercelConnectionPublic | null;
}) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [teamId, setTeamId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = connection?.status === "active";
  const isError = connection?.status === "error";

  async function handleConnect() {
    if (connecting || !token.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/connectors/vercel/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), teamId: teamId.trim() }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Couldn't save the token. Try again.");
        return;
      }
      setToken("");
      setTeamId("");
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
      const res = await fetch("/api/connectors/vercel/disconnect", {
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
          <span className={`mt-0.5 shrink-0 ${isActive ? "text-slate-100" : "text-slate-600"}`}>
            <VercelIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">Vercel</p>
            {isActive ? (
              <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">
                Connected{connection?.accountLabel ? ` as ${connection.accountLabel}` : ""}
                {connection?.teamId ? " (team)" : ""}. Your agent can create projects, set
                environment variables, and deploy — each one waits for your approval first.
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                Paste a Vercel API token so your agent can stand up and deploy projects on your own
                Vercel account. Nothing ships without your tap. Your token, your Vercel bill.
              </p>
            )}
            {isError && (
              <p className="text-xs text-amber-400 mt-1.5 leading-relaxed">
                Your saved token stopped working. Paste a fresh one to reconnect.
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
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Vercel API token"
            aria-label="Vercel API token"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee]/50 focus:outline-none"
          />
          <input
            type="text"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            placeholder="Team ID (optional — leave blank for your personal account)"
            aria-label="Vercel Team ID (optional)"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee]/50 focus:outline-none"
          />

          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="self-start text-xs text-[#22d3ee] hover:underline"
          >
            {showGuide ? "Hide" : "How do I create a Vercel token?"}
          </button>

          {showGuide && (
            <ol className="text-xs text-slate-400 leading-relaxed list-decimal pl-4 space-y-1 border-l border-slate-800 ml-1">
              <li>
                Go to{" "}
                <a
                  href="https://vercel.com/account/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#22d3ee] hover:underline"
                >
                  vercel.com/account/settings/tokens
                </a>{" "}
                (Vercel → Settings → Tokens).
              </li>
              <li>Click <span className="text-slate-300">Create Token</span>.</li>
              <li>Name it something like <span className="text-slate-300">Pocket Agent</span>.</li>
              <li>
                For Scope, pick your personal account, or a specific Team if these projects should
                live under your team. (Team tokens need the Team ID below.)
              </li>
              <li>
                Set an expiration you&apos;re comfortable with, then click{" "}
                <span className="text-slate-300">Create</span>.
              </li>
              <li>Copy the token and paste it above. You won&apos;t be able to see it again.</li>
              <li>
                Using a team? Find the Team ID at Vercel → your team → Settings → General, and paste
                it in the Team ID field.
              </li>
            </ol>
          )}

          <button
            onClick={handleConnect}
            disabled={connecting || !token.trim()}
            className="self-start inline-flex items-center rounded-lg bg-[#22d3ee] px-3.5 py-2 text-xs font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {connecting ? "Connecting…" : "Connect Vercel →"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400 pl-7">{error}</p>}
    </div>
  );
}
