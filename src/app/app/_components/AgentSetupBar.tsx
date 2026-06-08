"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Status-bar onboarding for the Agent landing — "X of 7 set up" with click-to-complete steps,
// the same growth pattern polished AI workspaces use. Shows only while setup is incomplete; once
// everything's wired it disappears and the landing is all work. The four account-level steps come
// from the server as props; persona / routine / memory counts are fetched here so the bar reflects
// real state without blocking the page.
type Step = { key: string; label: string; href: string; done: boolean };

export function AgentSetupBar({
  hasGithubToken,
  hasBrain,
  hasApiKey,
  hasConnection,
}: {
  hasGithubToken: boolean;
  hasBrain: boolean;
  hasApiKey: boolean;
  hasConnection: boolean;
}) {
  const [personaCount, setPersonaCount] = useState<number | null>(null);
  const [routineCount, setRoutineCount] = useState<number | null>(null);
  const [memoryFilled, setMemoryFilled] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/personas", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ personas: unknown[] }>) : Promise.reject()))
      .then((d) => setPersonaCount(d.personas.length))
      .catch(() => setPersonaCount(0));
    fetch("/api/app/routines", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ routines: { enabled: boolean }[] }>) : Promise.reject()))
      .then((d) => setRoutineCount(d.routines.filter((x) => x.enabled).length))
      .catch(() => setRoutineCount(0));
    if (hasBrain) {
      fetch("/api/app/brain/completeness", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ filled: number }>) : Promise.reject()))
        .then((d) => setMemoryFilled(d.filled))
        .catch(() => setMemoryFilled(0));
    } else {
      setMemoryFilled(0);
    }
  }, [hasBrain]);

  const steps: Step[] = [
    { key: "github", label: "Connect GitHub", href: "/api/app/auth/github?next=/app/onboarding", done: hasGithubToken },
    { key: "brain", label: "Connect your brain", href: "/app/onboarding", done: hasBrain },
    { key: "key", label: "Add your Anthropic key", href: "/app/settings", done: hasApiKey },
    { key: "memory", label: "Add your first memory", href: "/app/brain", done: (memoryFilled ?? 0) > 0 },
    { key: "connection", label: "Connect a tool", href: "/app/settings/connections", done: hasConnection },
    { key: "persona", label: "Create a persona", href: "/app/personas/new", done: (personaCount ?? 0) > 0 },
    { key: "routine", label: "Schedule a routine", href: "/app/routines", done: (routineCount ?? 0) > 0 },
  ];

  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return null;

  return (
    <div className="rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-100">Finish setting up your agent</p>
        <span className="shrink-0 text-[11px] font-mono text-[#22d3ee]/80">
          {completed} of {steps.length} done
        </span>
      </div>
      <div className="mt-2 h-1 rounded-full overflow-hidden bg-slate-800">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${(completed / steps.length) * 100}%`, background: "linear-gradient(to right, rgba(34,211,238,0.6), #22d3ee)" }}
        />
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-all min-h-[36px] ${
                s.done
                  ? "border-[#22d3ee]/30 bg-[#22d3ee]/10 text-[#22d3ee]/80"
                  : "border-slate-700/60 bg-slate-900/50 text-slate-300 hover:border-slate-600 hover:text-slate-100"
              }`}
            >
              <span className="text-xs">{s.done ? "✓" : "○"}</span>
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
