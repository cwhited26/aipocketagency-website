"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// Status-bar onboarding for the Agent landing — "X of 7 set up" with click-to-complete steps,
// the same growth pattern polished AI workspaces use. The four account-level steps come from the
// server as props; persona / routine / memory counts are fetched here so the bar reflects real
// state without blocking the page.
//
// Visibility is durable on purpose. The bar stays up the whole time setup is incomplete — it never
// hides on its own while items remain. It goes away in exactly two cases:
//   1. The owner taps Dismiss (×). That choice is remembered in localStorage AND on their account
//      row, so it stays hidden across devices and sessions until they bring it back from Settings.
//   2. All seven items are genuinely done — then it shows a brief "Setup complete 🎉" and quietly
//      retires itself (and records the dismissal so it doesn't pop back the next visit).
// The completion check waits for the client-fetched counts to load first, so a fully wired account
// never flashes the bar and then yanks it away before it can be read.
const STORAGE_KEY = "pa_setup_bar_dismissed";
const CELEBRATE_MS = 2600;

type Step = { key: string; label: string; href: string; done: boolean };

export function AgentSetupBar({
  hasGithubToken,
  hasBrain,
  hasApiKey,
  hasConnection,
  setupBarDismissedAt,
}: {
  hasGithubToken: boolean;
  hasBrain: boolean;
  hasApiKey: boolean;
  hasConnection: boolean;
  // ISO timestamp from the owner's account row, or null if they've never dismissed the bar.
  setupBarDismissedAt: string | null;
}) {
  const [personaCount, setPersonaCount] = useState<number | null>(null);
  const [routineCount, setRoutineCount] = useState<number | null>(null);
  const [memoryFilled, setMemoryFilled] = useState<number | null>(null);

  // Seed from the server so the first client render matches SSR (no hydration mismatch). After
  // mount we also fold in localStorage, which covers a dismissal made on this device before the
  // account row had synced.
  const [dismissed, setDismissed] = useState(setupBarDismissedAt != null);
  const [celebrating, setCelebrating] = useState(false);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") setDismissed(true);
  }, []);

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

  useEffect(() => () => {
    if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
  }, []);

  // Remember the dismissal everywhere: localStorage for instant cross-tab/offline truth, and the
  // account row so it carries to the owner's other devices. The localStorage write is the source of
  // truth for this device; the server sync is best-effort and intentionally doesn't block the UI.
  const persistDismissed = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    void fetch("/api/app/setup-bar/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    }).catch(() => {
      // Best-effort sync only — the bar is already hidden locally and will reconcile on next load.
    });
  }, []);

  function handleDismiss() {
    setDismissed(true);
    persistDismissed();
  }

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
  // The three counts start null and resolve from the network; only trust "everything's done" once
  // they've all arrived, so we never celebrate-and-vanish on a half-loaded page.
  const countsLoaded = personaCount !== null && routineCount !== null && memoryFilled !== null;
  const allDone = completed === steps.length;

  // On genuine completion, play a short celebratory beat, then retire the bar for good.
  useEffect(() => {
    if (dismissed || celebrating) return;
    if (countsLoaded && allDone) {
      setCelebrating(true);
      celebrateTimer.current = setTimeout(() => {
        setDismissed(true);
        persistDismissed();
      }, CELEBRATE_MS);
    }
  }, [dismissed, celebrating, countsLoaded, allDone, persistDismissed]);

  if (dismissed) return null;

  if (celebrating) {
    return (
      <div className="rounded-xl border border-[#22d3ee]/30 bg-[#22d3ee]/10 px-5 py-4">
        <p className="text-sm font-semibold text-slate-100">Setup complete 🎉</p>
        <p className="text-[13px] text-slate-300 mt-0.5">
          Everything&apos;s wired — your agent has what it needs. This will tuck itself away.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-100">Finish setting up your agent</p>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[11px] font-mono text-[#22d3ee]/80">
            {completed} of {steps.length} done
          </span>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss setup checklist"
            title="Dismiss — bring it back anytime from Settings"
            className="flex items-center justify-center w-9 h-9 -mr-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <span aria-hidden className="text-base leading-none">×</span>
          </button>
        </div>
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
