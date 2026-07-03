"use client";

// Onboarding progress chip (PA-POS-36) — the small persistent "2/6 · Set up" chip pinned to the
// bottom corner of the workspace. Completion is detected server-side by the action that does the
// work (lib/onboarding/progress.ts); this component only reads. Click opens the checklist: done
// steps ticked, open steps deep-linked to the shipped route that completes them.
//
// Tier split (PA-POS-30 hard rule): Studio+/Enterprise see the credit bonus line; Personal Brain
// and Business Agent see the same checklist with a Poc pointer to the Skool community instead —
// no credit surface exists for them. The chip is persistent while steps remain and dismissible
// only after all six are done (localStorage, same posture as the AgentSetupBar).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ONBOARDING_COMPLETION_BONUS_CREDITS,
  ONBOARDING_STEP_BONUS_CREDITS,
  ONBOARDING_STEPS,
  type OnboardingStepSlug,
} from "@/data/onboarding-steps";
import { SKOOL_URL } from "@/lib/constants/skool";

const DISMISS_KEY = "pa_onboarding_chip_dismissed";

type Progress = {
  completed: OnboardingStepSlug[];
  creditRewards: boolean;
  starterTier: boolean;
};

export default function OnboardingProgressChip() {
  const pathname = usePathname();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(true); // assume dismissed until localStorage says otherwise
  const [skipping, setSkipping] = useState(false);

  const load = useCallback(() => {
    fetch("/api/app/onboarding/progress", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Progress>) : Promise.reject()))
      .then(setProgress)
      .catch(() => setProgress(null));
  }, []);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    load();
  }, [load]);

  // The vertical picker / brain onboarding own those screens — don't talk over them.
  if (pathname?.startsWith("/app/onboarding") || pathname?.startsWith("/app/login")) return null;
  if (!progress) return null;

  const done = new Set(progress.completed);
  const total = ONBOARDING_STEPS.length;
  const count = ONBOARDING_STEPS.filter((s) => done.has(s.slug)).length;
  const allDone = count === total;

  // Persistent while work remains; dismissible once complete.
  if (allDone && dismissed) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    setOpen(false);
  }

  async function handleSkip(step: OnboardingStepSlug) {
    setSkipping(true);
    try {
      await fetch("/api/app/onboarding/steps/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step }),
      });
    } catch {
      // Read-back below settles the truth either way.
    }
    load();
    setSkipping(false);
  }

  return (
    <>
      <button
        type="button"
        data-testid="onboarding-progress-chip"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-5 md:right-5 z-40 flex items-center gap-2 rounded-full border border-[#22d3ee]/25 bg-[#0a0f16] px-3.5 py-2 text-[12px] text-slate-200 shadow-lg shadow-black/40 hover:border-[#22d3ee]/50 transition-colors"
        aria-label={`Workspace setup — ${count} of ${total} steps done`}
      >
        <span className="font-mono text-[#22d3ee]">{count}/{total}</span>
        <span aria-hidden className="text-slate-600">·</span>
        <span>{allDone ? "Done" : "Set up"}</span>
        {!allDone && <span aria-hidden className="text-[#22d3ee]/70">→</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace setup checklist"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-800 bg-[#05070a] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-100">Set up your workspace</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[#22d3ee]/80">{count}/{total}</span>
                <button
                  type="button"
                  onClick={allDone ? handleDismiss : () => setOpen(false)}
                  aria-label={allDone ? "Dismiss checklist" : "Close checklist"}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800/60 hover:text-slate-200 transition-colors"
                >
                  <span aria-hidden className="text-base leading-none">×</span>
                </button>
              </div>
            </div>

            <p className="mt-1 text-[12px] text-slate-400">
              {progress.creditRewards
                ? allDone
                  ? `All six done — ${
                      total * ONBOARDING_STEP_BONUS_CREDITS + ONBOARDING_COMPLETION_BONUS_CREDITS
                    } credits added this cycle.`
                  : `Each step adds ${ONBOARDING_STEP_BONUS_CREDITS} credits. All six adds another ${ONBOARDING_COMPLETION_BONUS_CREDITS}.`
                : allDone
                  ? "All six done. Your agent has a real workspace now."
                  : "Six steps, each one real work your agent builds on."}
            </p>

            <ul className="mt-4 space-y-1.5">
              {ONBOARDING_STEPS.map((step) => {
                const isDone = done.has(step.slug);
                const showSkip =
                  !isDone && progress.starterTier && step.skippableOnStarter === true;
                return (
                  <li
                    key={step.slug}
                    className={`rounded-lg border px-3 py-2.5 ${
                      isDone
                        ? "border-[#22d3ee]/25 bg-[#22d3ee]/5"
                        : "border-slate-800 bg-slate-900/40"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className={`mt-0.5 text-xs ${isDone ? "text-[#22d3ee]" : "text-slate-600"}`}
                      >
                        {isDone ? "✓" : "○"}
                      </span>
                      <div className="min-w-0 flex-1">
                        {isDone ? (
                          <p className="text-[13px] text-slate-300">{step.title}</p>
                        ) : (
                          <Link
                            href={step.href}
                            onClick={() => setOpen(false)}
                            className="text-[13px] text-slate-100 hover:text-[#22d3ee] transition-colors"
                          >
                            {step.title} <span aria-hidden className="text-[#22d3ee]/70">→</span>
                          </Link>
                        )}
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                          {step.detail}
                        </p>
                      </div>
                      {showSkip && (
                        <button
                          type="button"
                          disabled={skipping}
                          onClick={() => void handleSkip(step.slug)}
                          className="shrink-0 rounded-md border border-slate-700/60 px-2 py-1 text-[11px] text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors disabled:opacity-50"
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {!progress.creditRewards && (
              <p className="mt-4 text-[12px] text-slate-400">
                Poc&apos;s here to help — and so is the community.{" "}
                <a
                  href={SKOOL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#22d3ee] hover:underline"
                >
                  Open the Skool community
                </a>
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
