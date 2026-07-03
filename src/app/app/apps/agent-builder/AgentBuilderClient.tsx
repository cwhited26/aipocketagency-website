"use client";

// AgentBuilderClient — the compose surface. Owner describes the agent; one call composes it
// (Persona + Apps + Skills + brain scopes) and stages ONE approval card in Mission Control.
// Nothing runs, sends, or lands in the repo until the owner approves there.

import { useState } from "react";
import Link from "next/link";

type BuildRowView = {
  id: string;
  specText: string;
  status: string;
  personaSlug: string | null;
  createdAt: string;
};

type ComposeResponse = {
  buildId: string;
  inboxItemId: string;
  personaName: string;
  apps: string[];
  skillSlugs: string[];
  brainScopes: string[];
  schedule: string | null;
  candidateSkill: { slug: string; name: string } | null;
};

const EXAMPLE_SPECS = [
  "Watch my Gmail for adjuster emails and draft SRA responses in my voice.",
  "Every Monday at 8am, sweep my pipeline for quotes with no reply and draft follow-ups.",
  "Watch my competitors' sites and tell me when their pricing changes.",
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Composing",
  awaiting_approval: "Waiting on your approval",
  approved: "Approved",
  rejected: "Rejected",
  failed: "Didn't compose",
};

export default function AgentBuilderClient({
  unlocked,
  prefillSpec,
  initialBuilds,
}: {
  unlocked: boolean;
  prefillSpec: string;
  initialBuilds: BuildRowView[];
}) {
  const [spec, setSpec] = useState(prefillSpec);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [staged, setStaged] = useState<ComposeResponse | null>(null);

  async function compose() {
    const trimmed = spec.trim();
    if (trimmed.length < 12 || busy) return;
    setBusy(true);
    setErr(null);
    setSuggestion(null);
    setStaged(null);
    try {
      const res = await fetch("/api/app/agent-builder/compose", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as ComposeResponse & {
        error?: string;
        suggestion?: string;
      };
      if (!res.ok) {
        setErr(body.error ?? `Compose failed (${res.status})`);
        setSuggestion(body.suggestion ?? null);
        return;
      }
      setStaged(body);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            Custom Agent Builder
          </div>
          <h1 className="text-2xl font-bold text-slate-100">
            Describe the agent you need.
          </h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Pocket Agent composes it inside your workspace and stages it for your approval before
            it runs — a Persona built from your templates, the Apps it needs, the Skills it starts
            with, and the brain zones it may read. The agent lives in your Business Brain repo.
            Not our database.
          </p>
        </div>

        {!unlocked ? (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 px-6 py-6">
            <span className="text-[10px] font-mono border rounded px-1.5 py-0.5 uppercase tracking-wider text-slate-500 border-slate-700">
              Studio+
            </span>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              The Custom Agent Builder is part of the AI Agent Workspace tier — composing an agent
              runs the same planning engine as the Idea Engine.
            </p>
            <Link
              href="/pricing"
              className="mt-4 inline-block rounded-xl bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
            >
              See plans →
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-[#22d3ee]/15 bg-slate-900/60 p-5">
              <textarea
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                rows={4}
                placeholder='e.g. "Watch my Gmail for adjuster emails and draft SRA responses in my voice."'
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 leading-relaxed focus:border-[#22d3ee] focus:outline-none resize-y"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXAMPLE_SPECS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setSpec(example)}
                    className="rounded-full border border-slate-700/70 px-2.5 py-1 text-[11px] text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>

              {err && (
                <div className="mt-3">
                  <p className="text-xs text-red-400 font-mono">{err}</p>
                  {suggestion && <p className="mt-1 text-xs text-slate-400">{suggestion}</p>}
                </div>
              )}

              <button
                onClick={compose}
                disabled={busy || spec.trim().length < 12}
                className="mt-4 w-full min-h-[44px] rounded-xl bg-[#22d3ee] px-4 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Composing…" : "Compose the agent →"}
              </button>
              <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">
                Composing stages one approval card in Mission Control. Nothing runs until you
                approve it there.
              </p>
            </div>

            {staged && (
              <div className="mt-5 rounded-2xl border border-[#22d3ee]/25 bg-[#22d3ee]/5 p-5">
                <p className="text-sm font-semibold text-slate-100">
                  {staged.personaName} is staged for your approval.
                </p>
                <ul className="mt-2 text-[13px] text-slate-300 leading-relaxed space-y-1">
                  <li>Apps: {staged.apps.join(", ") || "none"}</li>
                  <li>Skills: {staged.skillSlugs.join(", ") || "none"}</li>
                  <li>Brain zones: {staged.brainScopes.join(", ") || "none"}</li>
                  <li>Schedule: {staged.schedule ?? "on demand"}</li>
                  {staged.candidateSkill && (
                    <li>New candidate Skill: {staged.candidateSkill.name}</li>
                  )}
                </ul>
                <Link
                  href="/app/mission-control"
                  className="mt-3 inline-block text-sm font-semibold text-[#22d3ee] hover:underline"
                >
                  Review it in Mission Control →
                </Link>
              </div>
            )}

            {initialBuilds.length > 0 && (
              <div className="mt-8">
                <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
                  Your composed agents
                </span>
                <div className="mt-2 flex flex-col gap-2">
                  {initialBuilds.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3"
                    >
                      <p className="text-sm text-slate-200 leading-snug line-clamp-2">
                        {b.specText}
                      </p>
                      <p className="mt-1 text-[11px] font-mono text-slate-500">
                        {STATUS_LABELS[b.status] ?? b.status}
                        {b.personaSlug ? ` · ${b.personaSlug}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
