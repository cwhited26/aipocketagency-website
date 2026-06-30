"use client";

// TelegramConnectionCard — the Channels Gateway Telegram surface in Settings → Connections
// (Channels Gateway Phase 2, PA-CHAN-1/7/8). Telegram pairs by bot-token paste (no OAuth redirect):
// the owner mints a bot in BotFather, pastes the token + a webhook secret, and saves. Once connected,
// a green status pill, the default-Persona picker (PA-CHAN-8), and Disconnect. Mirrors the existing
// connection cards: local state for in-flight actions, router.refresh() after a mutation.

import { useState } from "react";
import { useRouter } from "next/navigation";

type PersonaOption = { id: string; name: string };

function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21.5 4.3 18.2 19c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L5.8 13 1 11.5c-1-.3-1-1 .2-1.5L20.2 3c.9-.3 1.6.2 1.3 1.3Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TelegramConnectionCard({
  connected,
  enabled,
  botUsername,
  currentPersonaId,
  personas,
  tierCanConnect,
  tierLabel,
}: {
  connected: boolean;
  enabled: boolean;
  botUsername: string | null;
  currentPersonaId: string | null;
  personas: PersonaOption[];
  tierCanConnect: boolean;
  tierLabel: string;
}) {
  const router = useRouter();
  const [botToken, setBotToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [persona, setPersona] = useState(currentPersonaId ?? "");
  const [savingPersona, setSavingPersona] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectErrorCopy: Record<string, string> = {
    invalid_token: "That bot token didn't work. Copy it again from BotFather and retry.",
    invalid_secret: "The webhook secret can only use letters, numbers, _ and - (up to 256 chars).",
    set_webhook_failed: "Couldn't register the webhook with Telegram. Check the token and try again.",
    telegram_error: "Telegram didn't respond. Give it a moment and try again.",
    tier_blocked: "Telegram is part of the Business Agent plan and up.",
    store_failed: "Saved the bot but couldn't store the connection. Try again.",
  };

  function generateSecret() {
    // A random, Telegram-valid secret ([A-Za-z0-9_-]); the owner can still paste their own instead.
    setWebhookSecret(crypto.randomUUID().replace(/-/g, ""));
  }

  async function connect() {
    if (connecting) return;
    setConnecting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/channels/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: botToken.trim(), webhookSecret: webhookSecret.trim() }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(connectErrorCopy[body.error ?? ""] ?? "Couldn't connect Telegram. Try again.");
        return;
      }
      setBotToken("");
      setWebhookSecret("");
      router.refresh();
    } finally {
      setConnecting(false);
    }
  }

  async function savePersona(next: string) {
    setSavingPersona(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/channels/telegram/persona", {
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

  async function disconnect() {
    if (disconnecting) return;
    setDisconnecting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/channels/telegram/disconnect", { method: "POST", cache: "no-store" });
      if (!res.ok) {
        setError("Disconnect failed. Try again.");
        return;
      }
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  // ── Connected: status pill + persona picker + disconnect ──
  if (connected) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className={`mt-0.5 shrink-0 ${enabled ? "text-[#22d3ee]" : "text-slate-600"}`}>
              <TelegramIcon />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100">Telegram</p>
              <p className="text-sm text-slate-300 mt-0.5 truncate">
                {botUsername ? `@${botUsername}` : "Bot connected"}
              </p>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                {enabled
                  ? "DM your bot anything — text, a voice note, or a PDF/CSV. It answers right there in Telegram."
                  : "Reconnect needed — the bot token was revoked or expired."}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-[#22d3ee] border border-[#22d3ee]/30 rounded px-2 py-1 bg-[#22d3ee]/5 shrink-0">
            {enabled ? "connected" : "reconnect"}
          </span>
        </div>

        <div className="mt-4 ml-7 space-y-1.5">
          <label className="text-xs font-medium text-slate-300" htmlFor="tg-persona-picker">
            Which agent answers in Telegram
          </label>
          <select
            id="tg-persona-picker"
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

        <div className="mt-4 ml-7">
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="text-xs text-slate-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>

        {notice && <p className="mt-3 text-xs text-[#22d3ee] pl-7">{notice}</p>}
        {error && <p className="mt-3 text-xs text-red-400 pl-7">{error}</p>}
      </div>
    );
  }

  // ── Not connected, below Business Agent: the upgrade path ──
  if (!tierCanConnect) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-slate-600">
            <TelegramIcon />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-100">Telegram</p>
            <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">
              Text your agent from Telegram — part of the Business Agent plan and up. You&apos;re on{" "}
              {tierLabel}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Not connected: the bot-token paste form ──
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-slate-600">
          <TelegramIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100">Telegram</p>
          <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">
            Text your agent from Telegram — DM it, send a voice note, or forward a PDF/CSV, and it
            answers in-place. Anything it drafts gets staged in your Inbox for your okay first.
          </p>

          <ol className="mt-3 space-y-1 text-[13px] text-slate-400 leading-relaxed list-decimal pl-4">
            <li>
              In Telegram, message <span className="text-slate-200">@BotFather</span> and send{" "}
              <span className="font-mono text-slate-200">/newbot</span>. Follow the prompts to name
              your bot.
            </li>
            <li>BotFather replies with a bot token — paste it below.</li>
            <li>Generate a webhook secret (or paste your own), then Connect.</li>
          </ol>

          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300" htmlFor="tg-bot-token">
                Bot token
              </label>
              <input
                id="tg-bot-token"
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456789:ABCdef-GhIJKlmnop…"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300" htmlFor="tg-webhook-secret">
                  Webhook secret
                </label>
                <button
                  type="button"
                  onClick={generateSecret}
                  className="text-[11px] text-[#22d3ee] hover:underline"
                >
                  Generate
                </button>
              </div>
              <input
                id="tg-webhook-secret"
                type="text"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="A random string (letters, numbers, _ and -)"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-slate-200 placeholder:text-slate-600"
              />
            </div>

            <button
              onClick={connect}
              disabled={connecting || botToken.trim() === "" || webhookSecret.trim() === ""}
              className="inline-flex items-center rounded-lg bg-[#22d3ee] px-3.5 py-2 text-xs font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {connecting ? "Connecting…" : "Connect Telegram →"}
            </button>
          </div>

          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
