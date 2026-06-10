"use client";

// SlackChannelClient — the interactive Slack channel card (PA-CHAN-1). Connect CTA → OAuth, the
// default-Persona picker (PA-CHAN-8), a "Send test message" button, and Disconnect. Mirrors the
// existing connection cards: local state for in-flight actions, router.refresh() after a mutation.

import { useState } from "react";
import { useRouter } from "next/navigation";

type PersonaOption = { id: string; name: string; role: string };

export default function SlackChannelClient({
  connected,
  enabled,
  workspace,
  currentPersonaId,
  personas,
  tierLabel,
  tierCanSee,
  tierCanConnect,
  oauthConfigured,
  statusParam,
}: {
  connected: boolean;
  enabled: boolean;
  workspace: string | null;
  currentPersonaId: string | null;
  personas: PersonaOption[];
  tierLabel: string;
  tierCanSee: boolean;
  tierCanConnect: boolean;
  oauthConfigured: boolean;
  statusParam: string | null;
}) {
  const router = useRouter();
  const [persona, setPersona] = useState<string>(currentPersonaId ?? "");
  const [savingPersona, setSavingPersona] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tier-gated below Business Agent: show the upgrade path, no connect.
  if (!tierCanSee) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-5">
        <p className="text-sm text-slate-300 leading-relaxed">
          Channels are part of the Business Agent plan and up. You&apos;re on {tierLabel}. Upgrade
          in Settings to text your agent from Slack.
        </p>
      </div>
    );
  }

  async function savePersona(next: string) {
    setSavingPersona(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/channels/slack/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId: next === "" ? null : next }),
        cache: "no-store",
      });
      if (!res.ok) {
        setError("Couldn't save that. Try again.");
        return;
      }
      setPersona(next);
      setNotice("Saved.");
      router.refresh();
    } finally {
      setSavingPersona(false);
    }
  }

  async function sendTest() {
    if (testing) return;
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/channels/slack/test", { method: "POST", cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          body.error === "needs_reconnect"
            ? "Your Slack token expired — reconnect to send."
            : "Couldn't send the test message. Try again.",
        );
        return;
      }
      setNotice("Sent — check your Slack DM with the agent.");
    } finally {
      setTesting(false);
    }
  }

  async function disconnect() {
    if (disconnecting) return;
    setDisconnecting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/channels/slack/disconnect", { method: "POST", cache: "no-store" });
      if (!res.ok) {
        setError("Disconnect failed. Try again.");
        return;
      }
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  const installUrl = "/api/channels/slack/install";

  // ── Not connected: the Connect CTA ──
  if (!connected) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-5 space-y-3">
        {statusParam === "error" && (
          <p className="text-sm text-amber-400/90">That didn&apos;t go through. Try connecting again.</p>
        )}
        {!oauthConfigured ? (
          <p className="text-sm text-amber-400/90 leading-relaxed">
            Slack OAuth isn&apos;t configured on this deployment yet. Once the Slack app credentials are
            set, the Connect button appears here.
          </p>
        ) : !tierCanConnect ? (
          <p className="text-sm text-slate-300 leading-relaxed">
            Slack is available on the Business Agent plan and up. You&apos;re on {tierLabel}.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-400 leading-relaxed">
              Connect your Slack workspace to start texting your agent from Slack.
            </p>
            <a
              href={installUrl}
              className="inline-flex items-center rounded-lg bg-[#22d3ee] px-3.5 py-2 text-xs font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
            >
              Connect Slack →
            </a>
          </>
        )}
      </div>
    );
  }

  // ── Connected: persona picker + test + disconnect ──
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">
            {workspace ?? "Connected workspace"}
          </p>
          <p className="text-sm text-slate-400 mt-0.5">
            {enabled
              ? "Connected. DM your agent or @mention it in a channel."
              : "Reconnect needed — your Slack token was revoked or expired."}
          </p>
        </div>
        <span className="text-[10px] font-mono text-[#22d3ee] border border-[#22d3ee]/30 rounded px-2 py-1 bg-[#22d3ee]/5 shrink-0">
          {enabled ? "connected" : "reconnect"}
        </span>
      </div>

      {!enabled && (
        <a
          href={installUrl}
          className="inline-flex items-center rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-[#2a1a00] hover:bg-amber-300 transition-colors"
        >
          Reconnect →
        </a>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-300" htmlFor="persona-picker">
          Which agent answers in Slack
        </label>
        <select
          id="persona-picker"
          value={persona}
          disabled={savingPersona}
          onChange={(e) => savePersona(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
        >
          <option value="">Default (Admin Assistant)</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={sendTest}
          disabled={testing || !enabled}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {testing ? "Sending…" : "Send test message"}
        </button>
        <button
          onClick={disconnect}
          disabled={disconnecting}
          className="text-xs text-slate-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {disconnecting ? "Disconnecting…" : "Disconnect"}
        </button>
      </div>

      {notice && <p className="text-xs text-[#22d3ee]">{notice}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
