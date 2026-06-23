"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function DeepgramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 11.5c2-.5 3-2 3-3.5S4 5 2 4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M6 13c3.5-.8 5.5-2.8 5.5-5S9.5 3.8 6 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function formatVerified(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DeepgramConnectCard({
  connected,
  verifiedAt,
}: {
  connected: boolean;
  verifiedAt: string | null;
}) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    if (connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/app/meeting-persona/deepgram-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey.trim() }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Couldn't save the key. Try again.");
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
      const res = await fetch("/api/app/meeting-persona/deepgram-connect", {
        method: "DELETE",
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

  const verified = formatVerified(verifiedAt);

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`mt-0.5 shrink-0 ${connected ? "text-emerald-400" : "text-slate-600"}`}>
            <DeepgramIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">Deepgram</p>
            {connected ? (
              <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">
                Connected{verified ? ` — key checked ${verified}` : ""}. Deepgram does the real-time
                transcription for your Meeting Persona.
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                Deepgram does real-time transcription for your Meeting Persona. Sign up at
                deepgram.com — they give $200 in free credits to start. Paste the key, you&apos;re
                connected.
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 mt-0.5">
          {connected ? (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-emerald-400 border border-emerald-400/30 rounded px-2 py-1 bg-emerald-400/5">
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
          ) : (
            <span className="text-[10px] font-mono text-slate-600 border border-slate-700 rounded px-2 py-1">
              not connected
            </span>
          )}
        </div>
      </div>

      {!connected && (
        <div className="mt-4 pl-7 flex flex-col gap-3">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Deepgram API key"
            aria-label="Deepgram API key"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/50 focus:outline-none"
          />
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Generate one at{" "}
            <a
              href="https://console.deepgram.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 underline hover:text-emerald-400"
            >
              console.deepgram.com
            </a>
            . It&apos;s stored encrypted and never shown again.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting || apiKey.trim().length < 20}
            className="self-start inline-flex items-center rounded-lg bg-emerald-400 px-3.5 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {connecting ? "Connecting…" : "Connect Deepgram →"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400 pl-7">{error}</p>}
    </div>
  );
}
