"use client";

// VoiceSettingsClient — the interactive Voice Call setup card. Talks to the /api/channels/voice/*
// routes. Raw Tailwind on the app's dark surface (no shared ui kit). All state is local; the page is
// re-fetched on a hard navigation after a connect/disconnect.

import { useState } from "react";

type PersonaOption = { id: string; name: string };
type VoiceOption = { id: string; label: string; blurb: string };
type RecentCall = {
  id: string;
  startedAt: string;
  durationSeconds: number | null;
  status: string;
};

type Props = {
  flagEnabled: boolean;
  configured: boolean;
  connected: boolean;
  enabled: boolean;
  phoneNumber: string | null;
  pool: "own" | "shared" | null;
  callerNumber: string | null;
  currentPersonaId: string | null;
  currentVoiceId: string | null;
  personas: PersonaOption[];
  voiceCatalog: VoiceOption[];
  tierLabel: string;
  canUseOwnNumber: boolean;
  canUseCustomVoice: boolean;
  monthlyCapMinutes: number | null;
  usedMinutesThisMonth: number;
  recentCalls: RecentCall[];
};

type Busy = "idle" | "provision" | "persona" | "test" | "disconnect";

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  return { ok: res.ok && data.ok !== false, error: data.error };
}

export default function VoiceSettingsClient(props: Props) {
  const [personaId, setPersonaId] = useState<string>(props.currentPersonaId ?? props.personas[0]?.id ?? "");
  const [voiceId, setVoiceId] = useState<string>(props.currentVoiceId ?? props.voiceCatalog[0]?.id ?? "");
  const [customVoice, setCustomVoice] = useState<string>("");
  const [pool, setPool] = useState<"own" | "shared">(props.pool ?? (props.canUseOwnNumber ? "own" : "shared"));
  const [areaCode, setAreaCode] = useState<string>("");
  const [callerNumber, setCallerNumber] = useState<string>(props.callerNumber ?? "");
  const [busy, setBusy] = useState<Busy>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveVoiceId = customVoice.trim() !== "" ? customVoice.trim() : voiceId;

  function flash(ok: boolean, text: string) {
    if (ok) {
      setMessage(text);
      setError(null);
    } else {
      setError(text);
      setMessage(null);
    }
  }

  async function onProvision() {
    setBusy("provision");
    const res = await postJson("/api/channels/voice/provision", {
      pool,
      voiceId: effectiveVoiceId,
      personaId: personaId || undefined,
      areaCode: pool === "own" ? areaCode || undefined : undefined,
      callerNumber: pool === "shared" ? callerNumber || undefined : undefined,
    });
    setBusy("idle");
    flash(res.ok, res.ok ? "Voice connected. Reload to see your number." : res.error ?? "Couldn't connect.");
  }

  async function onSavePersona() {
    setBusy("persona");
    const res = await postJson("/api/channels/voice/persona", {
      personaId,
      voiceId: effectiveVoiceId,
    });
    setBusy("idle");
    flash(res.ok, res.ok ? "Persona + voice saved." : res.error ?? "Couldn't save.");
  }

  async function onTestCall() {
    setBusy("test");
    const res = await postJson("/api/channels/voice/test-call", {});
    setBusy("idle");
    flash(res.ok, res.ok ? "Calling you now — pick up to talk to your agent." : res.error ?? "Couldn't call.");
  }

  async function onDisconnect() {
    setBusy("disconnect");
    const res = await postJson("/api/channels/voice/disconnect", {});
    setBusy("idle");
    flash(res.ok, res.ok ? "Disconnected. Reload to refresh." : res.error ?? "Couldn't disconnect.");
  }

  const capLabel = props.monthlyCapMinutes === null ? "Unlimited" : `${props.monthlyCapMinutes} min/mo`;
  const usagePct =
    props.monthlyCapMinutes && props.monthlyCapMinutes > 0
      ? Math.min(100, Math.round((props.usedMinutesThisMonth / props.monthlyCapMinutes) * 100))
      : 0;

  return (
    <div className="space-y-7">
      {!props.flagEnabled && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Voice Call is in preview and switched off for now. Setup is visible so it can be configured;
          calls start working once it&apos;s enabled.
        </div>
      )}
      {props.flagEnabled && !props.configured && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          Voice isn&apos;t fully configured yet (Twilio / ElevenLabs / OpenAI keys). Contact support.
        </div>
      )}

      {props.connected && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Connected on{" "}
          <span className="font-semibold">{props.phoneNumber ?? "your number"}</span>{" "}
          ({props.pool === "own" ? "your own number" : "shared pool"}
          {props.enabled ? "" : " — disabled"}). Plan: {props.tierLabel}, {capLabel}.
        </div>
      )}

      {/* Persona */}
      <section className="space-y-2">
        <label className="block text-sm font-medium text-slate-200">Who answers</label>
        <select
          value={personaId}
          onChange={(e) => setPersonaId(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-[#0b0f15] px-3 py-2 text-sm text-slate-100"
        >
          {props.personas.length === 0 && <option value="">No personas yet — create one first</option>}
          {props.personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </section>

      {/* Voice catalog */}
      <section className="space-y-2">
        <label className="block text-sm font-medium text-slate-200">Voice</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {props.voiceCatalog.map((v) => {
            const active = customVoice.trim() === "" && voiceId === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setVoiceId(v.id);
                  setCustomVoice("");
                }}
                className={
                  "rounded-md border px-3 py-2 text-left text-xs transition " +
                  (active
                    ? "border-sky-400 bg-sky-400/10 text-slate-100"
                    : "border-slate-700 bg-[#0b0f15] text-slate-300 hover:border-slate-500")
                }
              >
                <span className="block font-semibold">{v.label}</span>
                <span className="block text-[11px] text-slate-400">{v.blurb}</span>
              </button>
            );
          })}
        </div>
        {props.canUseCustomVoice && (
          <input
            value={customVoice}
            onChange={(e) => setCustomVoice(e.target.value)}
            placeholder="Or paste a custom ElevenLabs voice id (Studio+)"
            className="mt-1 w-full rounded-md border border-slate-700 bg-[#0b0f15] px-3 py-2 text-sm text-slate-100"
          />
        )}
      </section>

      {/* Number / pool */}
      <section className="space-y-3">
        <label className="block text-sm font-medium text-slate-200">Phone number</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPool("shared")}
            className={
              "flex-1 rounded-md border px-3 py-2 text-xs " +
              (pool === "shared"
                ? "border-sky-400 bg-sky-400/10 text-slate-100"
                : "border-slate-700 bg-[#0b0f15] text-slate-300")
            }
          >
            Shared pool
            <span className="block text-[11px] text-slate-400">No own number — lower tiers</span>
          </button>
          <button
            type="button"
            disabled={!props.canUseOwnNumber}
            onClick={() => setPool("own")}
            className={
              "flex-1 rounded-md border px-3 py-2 text-xs disabled:opacity-40 " +
              (pool === "own"
                ? "border-sky-400 bg-sky-400/10 text-slate-100"
                : "border-slate-700 bg-[#0b0f15] text-slate-300")
            }
          >
            My own number
            <span className="block text-[11px] text-slate-400">Workspace+ ($1/mo)</span>
          </button>
        </div>
        {pool === "own" ? (
          <input
            value={areaCode}
            onChange={(e) => setAreaCode(e.target.value)}
            placeholder="Preferred area code (optional, e.g. 415)"
            className="w-full rounded-md border border-slate-700 bg-[#0b0f15] px-3 py-2 text-sm text-slate-100"
          />
        ) : (
          <input
            value={callerNumber}
            onChange={(e) => setCallerNumber(e.target.value)}
            placeholder="The phone you'll call from, E.164 (e.g. +14155551234)"
            className="w-full rounded-md border border-slate-700 bg-[#0b0f15] px-3 py-2 text-sm text-slate-100"
          />
        )}
      </section>

      {/* Actions */}
      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onProvision}
          disabled={busy !== "idle" || !props.flagEnabled || personaId === ""}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-40"
        >
          {busy === "provision" ? "Connecting…" : props.connected ? "Re-provision" : "Connect voice"}
        </button>
        {props.connected && (
          <>
            <button
              type="button"
              onClick={onSavePersona}
              disabled={busy !== "idle" || personaId === ""}
              className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:border-slate-400 disabled:opacity-40"
            >
              {busy === "persona" ? "Saving…" : "Save persona + voice"}
            </button>
            <button
              type="button"
              onClick={onTestCall}
              disabled={busy !== "idle" || !props.flagEnabled}
              className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:border-slate-400 disabled:opacity-40"
            >
              {busy === "test" ? "Calling…" : "Test call"}
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              disabled={busy !== "idle"}
              className="rounded-md border border-rose-600/50 px-4 py-2 text-sm text-rose-300 hover:border-rose-400 disabled:opacity-40"
            >
              {busy === "disconnect" ? "…" : "Disconnect"}
            </button>
          </>
        )}
      </section>

      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {/* Usage */}
      <section className="space-y-2 border-t border-slate-800 pt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-slate-200">This month</h2>
          <span className="text-xs text-slate-400">
            {props.usedMinutesThisMonth} min used · {capLabel}
          </span>
        </div>
        {props.monthlyCapMinutes !== null && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-sky-500" style={{ width: `${usagePct}%` }} />
          </div>
        )}
        {props.recentCalls.length === 0 ? (
          <p className="text-xs text-slate-500">No calls yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800 text-xs">
            {props.recentCalls.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-1.5 text-slate-300">
                <span>{new Date(c.startedAt).toLocaleString()}</span>
                <span className="text-slate-400">
                  {c.durationSeconds != null ? `${Math.round(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s` : "—"}{" "}
                  · {c.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
