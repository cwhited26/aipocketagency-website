"use client";

import { useState } from "react";
import Link from "next/link";
import type { SignalCatcherSettings, Sensitivity } from "@/lib/signal-catcher/types";

// Settings → Signal Catcher (PA-SIGNAL-1). One toggle, one sensitivity dial, one save. The copy
// explains the primitive in the owner's terms: PA notices a standing wish in chat and proposes
// the ritual — every proposal is a card the owner decides, nothing runs on its own.

const SENSITIVITY_OPTIONS: Array<{
  value: Sensitivity;
  label: string;
  detail: string;
}> = [
  {
    value: "low",
    label: "Low",
    detail: "Only the clearest asks — you said what you want and when.",
  },
  {
    value: "medium",
    label: "Medium",
    detail: "The balanced default — clear wishes, even without an exact time.",
  },
  {
    value: "high",
    label: "High",
    detail: "Catch more hunches — expect a few proposals you'll toss.",
  },
];

export default function SignalCatcherSettingsClient({
  initial,
  tierAllows,
}: {
  initial: SignalCatcherSettings;
  tierAllows: boolean;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [sensitivity, setSensitivity] = useState<Sensitivity>(initial.sensitivity);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const res = await fetch("/api/app/signal-catcher/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ enabled, sensitivity }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Save failed (${res.status})`);
      }
      setNote("Saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-8">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#22d3ee]/60">
            Settings
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Signal Catcher</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Mention a wish in chat — &ldquo;I keep meaning to check my pipeline every Monday&rdquo; —
            and PA proposes it as a ritual. Every proposal is a card in Mission Control with your
            exact words on it. You approve, edit, or reject; nothing runs on its own.
          </p>
        </div>

        {!tierAllows && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-4">
            <span className="mt-0.5 shrink-0 font-mono text-sm text-[#22d3ee]">→</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Signal Catcher runs on the AI Agent Workspace plan and up.
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Your settings save either way and take effect when you upgrade.{" "}
                <Link href="/app/settings/tier" className="text-[#22d3ee] hover:underline">
                  See your plan →
                </Link>
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5">
          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-100">Watch my chats for signals</p>
              <p className="mt-1 text-xs text-slate-400">
                On by default. Turn it off and PA stops reading messages for wishes entirely.
              </p>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              aria-label="Signal Catcher on or off"
              className="h-5 w-5 accent-[#22d3ee]"
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-slate-700/60 bg-slate-900/60 p-5">
          <p className="text-sm font-semibold text-slate-100">Sensitivity</p>
          <p className="mt-1 text-xs text-slate-400">
            How sure PA has to be before it proposes anything.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {SENSITIVITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  sensitivity === opt.value
                    ? "border-[#22d3ee]/50 bg-[#22d3ee]/5"
                    : "border-slate-700/60 hover:border-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="sensitivity"
                  value={opt.value}
                  checked={sensitivity === opt.value}
                  onChange={() => setSensitivity(opt.value)}
                  className="mt-1 accent-[#22d3ee]"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-100">{opt.label}</span>
                  <span className="block text-xs text-slate-400">{opt.detail}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {err && <p className="mt-4 text-xs text-red-400 font-mono">{err}</p>}
        {note && <p className="mt-4 text-xs text-[#22d3ee] font-mono">{note}</p>}

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={save}
            disabled={busy}
            className="rounded-lg border border-[#22d3ee]/30 bg-[#22d3ee]/5 px-4 py-2.5 text-sm font-semibold text-[#22d3ee] hover:bg-[#22d3ee]/10 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <Link
            href="/app/apps/signal-catcher"
            className="text-sm text-slate-400 hover:text-[#22d3ee]"
          >
            See everything it has caught →
          </Link>
        </div>
      </div>
    </div>
  );
}
