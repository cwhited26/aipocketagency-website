"use client";

// ChannelConnectionCard — the shared Settings → Connections surface for the paste-in Channels
// Gateway channels (Phase 2 SMS, Phase 3 iMessage, Phase 4 WhatsApp — PA-CHAN-1/7/8/9). Each of
// these pairs by pasted credentials (no OAuth redirect): the owner follows the numbered steps,
// points the provider's webhook at the shown URL, pastes the fields, and saves. Once connected:
// a status pill, the default-Persona picker (PA-CHAN-8), and Disconnect. One component, three
// instances — the field list, copy, and endpoints arrive as props from the server page, so the
// three cards can't drift apart visually. Mirrors TelegramConnectionCard's states + styling.

import { useState } from "react";
import { useRouter } from "next/navigation";

type PersonaOption = { id: string; name: string };

export type ChannelFieldDef = {
  key: string;
  label: string;
  placeholder: string;
  password?: boolean;
  mono?: boolean;
  optional?: boolean;
  // Renders a "Generate" affordance that fills the field with a random secret.
  generate?: boolean;
};

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10.5 18.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5c-5 0-9 3.2-9 7.2 0 2.3 1.3 4.3 3.4 5.6-.1.9-.5 2.2-1.5 3.2 1.7-.2 3.1-.9 4-1.5.9.3 2 .4 3.1.4 5 0 9-3.2 9-7.2s-4-7.7-9-7.7Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M9 8.5c-.3 2.5 3.5 6.5 6.2 6.4l.9-1.4-2-1.3-.9.7c-1-.4-2-1.4-2.4-2.4l.8-.8-1.2-2.1-1.4.9Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICONS = { sms: PhoneIcon, imessage: MessageIcon, whatsapp: WhatsAppIcon } as const;
export type ChannelCardIcon = keyof typeof ICONS;

export default function ChannelConnectionCard({
  channel,
  icon,
  title,
  connected,
  enabled,
  connectedLine,
  connectedHint,
  reconnectHint,
  description,
  steps,
  webhookLabel,
  webhookUrl,
  fields,
  errorCopy,
  upgradeCopy,
  connectLabel,
  currentPersonaId,
  personas,
  tierCanConnect,
}: {
  // Drives the API endpoints: /api/channels/<channel>/{connect,persona,disconnect}.
  channel: string;
  icon: ChannelCardIcon;
  title: string;
  connected: boolean;
  enabled: boolean;
  connectedLine: string;
  connectedHint: string;
  reconnectHint: string;
  description: string;
  steps: string[];
  webhookLabel: string;
  webhookUrl: string;
  fields: ChannelFieldDef[];
  errorCopy: Record<string, string>;
  upgradeCopy: string;
  connectLabel: string;
  currentPersonaId: string | null;
  personas: PersonaOption[];
  tierCanConnect: boolean;
}) {
  const router = useRouter();
  const Icon = ICONS[icon];
  const [values, setValues] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);
  const [persona, setPersona] = useState(currentPersonaId ?? "");
  const [savingPersona, setSavingPersona] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requiredFilled = fields.every((f) => f.optional || (values[f.key] ?? "").trim() !== "");

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function generateSecret(key: string) {
    setField(key, crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""));
  }

  async function connect() {
    if (connecting) return;
    setConnecting(true);
    setError(null);
    setNotice(null);
    try {
      const body: Record<string, string> = {};
      for (const f of fields) {
        const v = (values[f.key] ?? "").trim();
        if (v) body[f.key] = v;
      }
      const res = await fetch(`/api/channels/${channel}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const resBody = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(errorCopy[resBody.error ?? ""] ?? `Couldn't connect ${title}. Try again.`);
        return;
      }
      setValues({});
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
      const res = await fetch(`/api/channels/${channel}/persona`, {
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
      const res = await fetch(`/api/channels/${channel}/disconnect`, {
        method: "POST",
        cache: "no-store",
      });
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
              <Icon />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100">{title}</p>
              <p className="text-sm text-slate-300 mt-0.5 truncate">{connectedLine}</p>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                {enabled ? connectedHint : reconnectHint}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-[#22d3ee] border border-[#22d3ee]/30 rounded px-2 py-1 bg-[#22d3ee]/5 shrink-0">
            {enabled ? "connected" : "reconnect"}
          </span>
        </div>

        <div className="mt-4 ml-7 space-y-1.5">
          <label className="text-xs font-medium text-slate-300" htmlFor={`${channel}-persona-picker`}>
            Which agent answers in {title}
          </label>
          <select
            id={`${channel}-persona-picker`}
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

  // ── Not connected, below the required tier: the upgrade path ──
  if (!tierCanConnect) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-slate-600">
            <Icon />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-100">{title}</p>
            <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">{upgradeCopy}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Not connected: the paste-in form ──
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-slate-600">
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100">{title}</p>
          <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">{description}</p>

          <ol className="mt-3 space-y-1 text-[13px] text-slate-400 leading-relaxed list-decimal pl-4">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-slate-300">{webhookLabel}</p>
            <p className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-300 break-all select-all">
              {webhookUrl}
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300" htmlFor={`${channel}-${f.key}`}>
                    {f.label}
                    {f.optional ? <span className="text-slate-600"> (optional)</span> : null}
                  </label>
                  {f.generate && (
                    <button
                      type="button"
                      onClick={() => generateSecret(f.key)}
                      className="text-[11px] text-[#22d3ee] hover:underline"
                    >
                      Generate
                    </button>
                  )}
                </div>
                <input
                  id={`${channel}-${f.key}`}
                  type={f.password ? "password" : "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  autoComplete="off"
                  className={`w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 ${
                    f.mono ? "font-mono" : ""
                  }`}
                />
              </div>
            ))}

            <button
              onClick={connect}
              disabled={connecting || !requiredFilled}
              className="inline-flex items-center rounded-lg bg-[#22d3ee] px-3.5 py-2 text-xs font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {connecting ? "Connecting…" : connectLabel}
            </button>
          </div>

          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
