"use client";

import { useState } from "react";
import Link from "next/link";
import type { LaunchKitSection, LaunchKitStep } from "@/lib/launch-kit/steps";

type ProgressResponse = { ok?: true; error?: string };

function StepRow({
  step,
  done,
  onToggle,
}: {
  step: LaunchKitStep;
  done: boolean;
  onToggle: (slug: string, completed: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-t border-slate-800/40 first:border-t-0">
      <button
        onClick={() => onToggle(step.slug, !done)}
        aria-label={done ? `Mark "${step.label}" not done` : `Mark "${step.label}" done`}
        className={`mt-0.5 shrink-0 flex items-center justify-center h-5 w-5 rounded border transition-colors ${
          done
            ? "bg-[#22d3ee]/15 border-[#22d3ee]/60 text-[#22d3ee]"
            : "border-slate-600 text-transparent hover:border-[#22d3ee]/50"
        }`}
      >
        <span aria-hidden className="text-[12px] leading-none">
          ✓
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            done ? "text-slate-400 line-through" : "text-slate-100"
          }`}
        >
          {step.label}
        </p>
        <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">{step.blurb}</p>
        <Link
          href={step.ctaHref}
          className="inline-block mt-1.5 text-[12px] text-[#22d3ee] hover:underline"
        >
          {step.ctaLabel} →
        </Link>
      </div>
    </div>
  );
}

export default function LaunchKitClient({
  sections,
  completed,
  stepCount,
  personaCount,
  seededWorkflowCount,
  starterSeedCount,
  guarantee,
}: {
  sections: LaunchKitSection[];
  completed: string[];
  stepCount: number;
  personaCount: number;
  seededWorkflowCount: number;
  starterSeedCount: number;
  guarantee: string;
}) {
  const [done, setDone] = useState<Set<string>>(() => new Set(completed));

  async function handleToggle(slug: string, completedNext: boolean) {
    // Optimistic — flip locally, then persist. Roll back if the write fails.
    setDone((prev) => {
      const next = new Set(prev);
      if (completedNext) next.add(slug);
      else next.delete(slug);
      return next;
    });
    try {
      const res = await fetch("/api/app/launch-kit/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step_slug: slug, completed: completedNext }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as ProgressResponse;
      if (!res.ok || !body.ok) throw new Error(body.error ?? "save failed");
    } catch {
      setDone((prev) => {
        const next = new Set(prev);
        if (completedNext) next.delete(slug);
        else next.add(slug);
        return next;
      });
    }
  }

  const completedCount = done.size;
  const pct = stepCount > 0 ? Math.round((completedCount / stepCount) * 100) : 0;
  const personasReady = personaCount >= 3;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
          Get set up in 7 days
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Launch Kit</h1>
        <p className="text-slate-300 text-sm mt-2 leading-relaxed">
          A short checklist to get your AI Office running. Fill your Business Brain, meet your
          Personas, run your first workflow, and read your first Mission Control review. Check items
          off as you go.
        </p>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-medium text-slate-300">Your progress</span>
          <span className="text-[12px] font-mono text-slate-400">
            {completedCount} of {stepCount}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-[#22d3ee] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Confirmation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
          <div className="flex items-center gap-2">
            {personasReady && (
              <span className="text-[#22d3ee]" aria-hidden>
                ▣
              </span>
            )}
            <p className="text-sm font-semibold text-slate-100">Your 3 starter Personas</p>
          </div>
          <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
            {personasReady
              ? `${personaCount} ready — they come pre-installed and tuned to your jobs.`
              : `${personaCount} so far. Your 3 starter Personas come pre-installed.`}
          </p>
          <Link
            href="/app/personas"
            className="inline-block mt-2 text-[12px] text-[#22d3ee] hover:underline"
          >
            View Personas →
          </Link>
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
          <div className="flex items-center gap-2">
            {seededWorkflowCount >= starterSeedCount && (
              <span className="text-[#22d3ee]" aria-hidden>
                ▣
              </span>
            )}
            <p className="text-sm font-semibold text-slate-100">Your 5 starter workflows</p>
          </div>
          <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
            {seededWorkflowCount} of {starterSeedCount} installed — one per category, ready to run.
          </p>
          <Link
            href="/app/apps/workflow-vault"
            className="inline-block mt-2 text-[12px] text-[#22d3ee] hover:underline"
          >
            Open the Vault →
          </Link>
        </div>
      </div>

      {/* Implementation guarantee callout */}
      <div className="rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/5 px-5 py-4">
        <p className="text-sm text-slate-200 leading-relaxed">{guarantee}</p>
      </div>

      {/* Checklist sections */}
      {sections.map((section) => (
        <div key={section.key}>
          <h2 className="text-sm font-semibold text-slate-200 mb-2">{section.title}</h2>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-5 py-1">
            {section.steps.map((step) => (
              <StepRow
                key={step.slug}
                step={step}
                done={done.has(step.slug)}
                onToggle={(slug, next) => void handleToggle(slug, next)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
