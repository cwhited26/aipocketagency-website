"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Mirrors SPEC_SECTIONS in lib/brain/isa.ts (kept inline to keep server code out of
// the client bundle).
const SECTIONS: { key: string; label: string; help: string }[] = [
  { key: "problem", label: "Problem", help: "What problem is this solving? Who feels it and why now?" },
  { key: "vision", label: "Vision", help: "What does the ideal end state look like once this is done?" },
  { key: "outOfScope", label: "Out of Scope", help: "What are you deliberately NOT doing here?" },
  { key: "principles", label: "Principles", help: "The non-negotiable values that guide every decision." },
  { key: "constraints", label: "Constraints", help: "Hard limits — budget, time, tech, legal, people." },
  { key: "goal", label: "Goal", help: "The single, concrete objective this spec drives toward." },
  { key: "successCriteria", label: "Success Criteria", help: "How you'll know it's done. Each line is a checkable item." },
  { key: "testStrategy", label: "Test Strategy", help: "How the result gets verified — tests, reviews, acceptance checks." },
  { key: "features", label: "Features", help: "The concrete capabilities or deliverables." },
  { key: "decisions", label: "Decisions", help: "Key decisions made and the reasoning behind them." },
  { key: "changelog", label: "Changelog", help: "A running log of notable changes to this spec." },
  { key: "verification", label: "Verification", help: "Final sign-off — what was checked and confirmed." },
];

const REQUIRED = new Set(["problem", "vision", "goal"]);

type Fields = Record<string, string>;
type SpecListItem = { path: string; scope: string; scopeLabel: string };

function emptyFields(): Fields {
  return Object.fromEntries(SECTIONS.map((s) => [s.key, ""]));
}

export default function SpecsClient({ hasGithubToken }: { hasGithubToken: boolean }) {
  const [specs, setSpecs] = useState<SpecListItem[] | null>(null);
  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [scope, setScope] = useState("");
  const [fields, setFields] = useState<Fields>(emptyFields());
  const [step, setStep] = useState(0); // 0 = scope, 1..12 = sections (new wizard)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadList() {
    try {
      const res = await fetch("/api/app/brain/specs");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = (await res.json()) as { specs: SpecListItem[] };
      setSpecs(data.specs);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load specs");
      setSpecs([]);
    }
  }

  useEffect(() => {
    void loadList();
  }, []);

  const set = (key: string, value: string) => setFields((f) => ({ ...f, [key]: value }));

  async function openEdit(item: SpecListItem) {
    setError(null);
    setScope(item.scope);
    try {
      const res = await fetch(`/api/app/brain/specs?scope=${encodeURIComponent(item.scope)}`);
      if (!res.ok) throw new Error(`Failed to load spec (${res.status})`);
      const data = (await res.json()) as { exists: boolean; fields?: Fields };
      setFields(data.exists && data.fields ? { ...emptyFields(), ...data.fields } : emptyFields());
      setView("edit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load spec");
    }
  }

  function startNew() {
    setScope("");
    setFields(emptyFields());
    setStep(0);
    setError(null);
    setView("new");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app/brain/specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, fields }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      await loadList();
      setView("list");
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
          Connect GitHub to write specs to your brain.{" "}
          <a href="/api/app/auth/github?next=/app/brain/specs" className="text-[#22d3ee] hover:underline">
            Connect GitHub →
          </a>
        </p>
      </Shell>
    );
  }

  // ── New-spec wizard (scope + one section per step) ───────────────────────────
  if (view === "new") {
    const onScopeStep = step === 0;
    const s = onScopeStep ? null : SECTIONS[step - 1];
    const isLast = step === SECTIONS.length;
    const requiredEmpty = s !== null && REQUIRED.has(s.key) && !(fields[s.key] ?? "").trim();

    return (
      <Shell onBack={() => setView("list")} backLabel="All specs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            Step {step + 1} of {SECTIONS.length + 1}
          </span>
        </div>
        <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#22d3ee] transition-[width] duration-300"
            style={{ width: `${((step + 1) / (SECTIONS.length + 1)) * 100}%` }}
          />
        </div>

        {onScopeStep ? (
          <div className="flex flex-col gap-2">
            <label className="text-base font-semibold text-slate-100">Where should this spec live?</label>
            <p className="text-xs text-slate-500">
              A folder in your brain (e.g. <span className="font-mono">projects/loyalty</span>). Leave blank
              for the repo root. The file is written as <span className="font-mono">SPEC.md</span> in that folder.
            </p>
            <input
              autoFocus
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-200 font-mono focus:border-[#22d3ee]/50 focus:outline-none"
              placeholder="projects/my-feature"
            />
            <p className="text-[11px] font-mono text-slate-600">
              → {scope.replace(/^\/+|\/+$/g, "").trim() ? `${scope.replace(/^\/+|\/+$/g, "").trim()}/SPEC.md` : "SPEC.md"}
            </p>
          </div>
        ) : s ? (
          <div className="flex flex-col gap-2">
            <label className="text-base font-semibold text-slate-100">
              {s.label}
              {REQUIRED.has(s.key) && <span className="text-[#22d3ee] ml-1">*</span>}
            </label>
            <p className="text-xs text-slate-500">{s.help}</p>
            <textarea
              autoFocus
              value={fields[s.key] ?? ""}
              onChange={(e) => set(s.key, e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-200 focus:border-[#22d3ee]/50 focus:outline-none resize-y"
            />
          </div>
        ) : null}

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
              disabled={requiredEmpty}
              className="ml-auto rounded-lg bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-4 py-2 text-xs font-mono text-[#22d3ee] hover:bg-[#22d3ee]/25 disabled:opacity-40"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving}
              className="ml-auto rounded-lg bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-4 py-2 text-xs font-mono text-[#22d3ee] hover:bg-[#22d3ee]/25 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Create spec"}
            </button>
          )}
        </div>
      </Shell>
    );
  }

  // ── Edit existing (full form) ────────────────────────────────────────────────
  if (view === "edit") {
    return (
      <Shell onBack={() => setView("list")} backLabel="All specs">
        <p className="text-xs font-mono text-slate-500">
          Editing <span className="text-slate-300">{scope || "Root"}</span> / SPEC.md
        </p>
        <div className="flex flex-col gap-5">
          {SECTIONS.map((s) => (
            <div key={s.key} className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-100">
                {s.label}
                {REQUIRED.has(s.key) && <span className="text-[#22d3ee] ml-1">*</span>}
              </label>
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
        <button
          onClick={save}
          disabled={saving}
          className="self-start rounded-lg bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-5 py-2.5 text-sm font-mono text-[#22d3ee] hover:bg-[#22d3ee]/25 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save spec"}
        </button>
      </Shell>
    );
  }

  // ── List ─────────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          A spec is a structured plan for any piece of work — problem, goal, success criteria, and more.
        </p>
        <button
          onClick={startNew}
          className="shrink-0 rounded-lg bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-4 py-2 text-xs font-mono text-[#22d3ee] hover:bg-[#22d3ee]/25"
        >
          + New spec
        </button>
      </div>

      {specs === null ? (
        <p className="text-[12px] font-mono text-slate-500">loading specs…</p>
      ) : loadError ? (
        <p className="text-xs text-red-400">{loadError}</p>
      ) : specs.length === 0 ? (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-6 text-center">
          <p className="text-sm text-slate-300 font-semibold">No specs yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Create your first spec to give your agent a clear target for a piece of work.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {specs.map((spec) => (
            <button
              key={spec.path}
              onClick={() => openEdit(spec)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg border border-slate-700/50 bg-slate-900/50 hover:bg-slate-800/60 hover:border-slate-600/60 transition-all text-left group"
            >
              <span className="text-[#22d3ee]/70 shrink-0">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 1.5h5L11 4v8.5H3v-11z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  <path d="M5 7h4M5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-200 group-hover:text-slate-100 block truncate">
                  {spec.scopeLabel}
                </span>
                <span className="text-[10px] font-mono text-slate-600 block truncate">{spec.path}</span>
              </div>
              <span className="text-slate-600 group-hover:text-slate-400 text-xs shrink-0">→</span>
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

function Shell({
  children,
  onBack,
  backLabel,
}: {
  children: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-7 flex flex-col gap-5">
        <div>
          {onBack ? (
            <button onClick={onBack} className="text-[11px] font-mono text-slate-500 hover:text-slate-300">
              ← {backLabel ?? "Back"}
            </button>
          ) : (
            <Link href="/app/brain" className="text-[11px] font-mono text-slate-500 hover:text-slate-300">
              ← Brain
            </Link>
          )}
          <h1 className="text-lg font-semibold text-slate-100 mt-2">Specs</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Structured plans your agent can build toward and check itself against.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
