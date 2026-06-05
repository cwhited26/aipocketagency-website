"use client";

import { useState } from "react";
import Link from "next/link";

// Display metadata mirrors TELOS_SECTIONS in lib/brain/telos.ts. Declared inline so the
// client bundle never pulls in the server-only brain-write code.
const SECTIONS: { key: string; label: string; help: string }[] = [
  { key: "mission", label: "Mission", help: "The one sentence that says why this business exists." },
  { key: "goals", label: "Goals", help: "What you're driving toward — concrete outcomes over the next 1–3 years." },
  { key: "beliefs", label: "Beliefs", help: "Core convictions about your market, customers, and how you operate." },
  { key: "wisdom", label: "Wisdom", help: "Hard-won lessons you want every decision to honor." },
  { key: "challenges", label: "Challenges", help: "The real obstacles and tensions standing in the way right now." },
  { key: "mentalModels", label: "Mental Models", help: "The frameworks and rules of thumb you think with." },
];

type Fields = Record<string, string>;

function emptyFields(): Fields {
  return Object.fromEntries(SECTIONS.map((s) => [s.key, ""]));
}

export default function NorthStarClient({
  initialFields,
  hasGithubToken,
}: {
  initialFields: Fields | null;
  hasGithubToken: boolean;
}) {
  const isFirstTime = initialFields === null;
  const [fields, setFields] = useState<Fields>(initialFields ?? emptyFields());
  // Wizard mode for first-time setup; edit-in-place once a North Star exists.
  const [wizard, setWizard] = useState(isFirstTime);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: string, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app/brain/north-star", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      setSaved(true);
      setWizard(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!hasGithubToken) {
    return (
      <Shell>
        <p className="text-sm text-slate-400">
          Connect GitHub to write your North Star to your brain.{" "}
          <a href="/api/app/auth/github?next=/app/brain/north-star" className="text-[#22d3ee] hover:underline">
            Connect GitHub →
          </a>
        </p>
      </Shell>
    );
  }

  // ── Wizard (first-time) ──────────────────────────────────────────────────────
  if (wizard) {
    const s = SECTIONS[step];
    const isLast = step === SECTIONS.length - 1;
    return (
      <Shell>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            Step {step + 1} of {SECTIONS.length}
          </span>
          <button
            onClick={() => setWizard(false)}
            className="text-[11px] font-mono text-slate-500 hover:text-slate-300"
          >
            Skip to full editor →
          </button>
        </div>
        <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#22d3ee] transition-[width] duration-300"
            style={{ width: `${((step + 1) / SECTIONS.length) * 100}%` }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-base font-semibold text-slate-100">{s.label}</label>
          <p className="text-xs text-slate-500">{s.help}</p>
          <textarea
            autoFocus
            value={fields[s.key] ?? ""}
            onChange={(e) => set(s.key, e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-200 focus:border-[#22d3ee]/50 focus:outline-none resize-y"
            placeholder={`Your ${s.label.toLowerCase()}…`}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep((p) => p - 1)}
              className="rounded-lg border border-slate-700/60 bg-slate-800/60 px-4 py-2 text-xs font-mono text-slate-300 hover:bg-slate-700/60"
            >
              Back
            </button>
          )}
          {!isLast ? (
            <button
              onClick={() => setStep((p) => p + 1)}
              className="ml-auto rounded-lg bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-4 py-2 text-xs font-mono text-[#22d3ee] hover:bg-[#22d3ee]/25"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving}
              className="ml-auto rounded-lg bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-4 py-2 text-xs font-mono text-[#22d3ee] hover:bg-[#22d3ee]/25 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save North Star"}
            </button>
          )}
        </div>
      </Shell>
    );
  }

  // ── Edit-in-place ────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="flex flex-col gap-5">
        {SECTIONS.map((s) => (
          <div key={s.key} className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-100">{s.label}</label>
            <p className="text-[11px] text-slate-500">{s.help}</p>
            <textarea
              value={fields[s.key] ?? ""}
              onChange={(e) => set(s.key, e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-200 focus:border-[#22d3ee]/50 focus:outline-none resize-y"
            />
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-5 py-2.5 text-sm font-mono text-[#22d3ee] hover:bg-[#22d3ee]/25 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save North Star"}
        </button>
        {saved && <span className="text-xs font-mono text-emerald-400">Saved ✓</span>}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-7 flex flex-col gap-5">
        <div>
          <Link href="/app/brain" className="text-[11px] font-mono text-slate-500 hover:text-slate-300">
            ← Brain
          </Link>
          <h1 className="text-lg font-semibold text-slate-100 mt-2">North Star</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Your business&apos;s mission, goals, and beliefs — the target your agent prioritizes work against.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
