"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WELCOME, BOTTLENECK_PICKER, SETUP_PATH } from "@/lib/copy/in-app";
import { trackEvent } from "@/lib/analytics/events";

// Bottleneck choice → where the owner starts (the recommended first action, Part 7B).
const BOTTLENECK_DESTINATIONS: Record<string, string> = {
  admin: "/app/personas",
  follow_up: "/app/apps/follow-up-sweeps",
  content: "/app/capture",
  email: "/app/apps/email",
  lead_research: "/app/apps/lead-scout",
  operations: "/app/brain-map",
  ideas: "/app/apps/idea-engine",
};

type Step = "welcome" | "bottleneck" | "path";

/**
 * First-login experience (GTM Phase 4, Part 7B): Welcome → bottleneck picker (7 options) → 7-day
 * setup path. Self-contained client wizard reachable at /app/welcome, kept separate from the existing
 * GitHub/brain-connect onboarding wizard so neither destabilizes the other. The chosen bottleneck is
 * stamped to a `first_login` analytics event and routes the owner at their next step.
 */
export function FirstLoginWelcome() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [bottleneck, setBottleneck] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("first_login");
  }, []);

  if (step === "welcome") {
    return (
      <div className="mx-auto max-w-xl space-y-5 py-10 text-center">
        <h1 className="text-2xl font-semibold text-slate-100">{WELCOME.headline}</h1>
        <p className="text-base font-medium text-[#22d3ee]/90">{WELCOME.subheadline}</p>
        <div className="space-y-3 text-sm leading-relaxed text-slate-400">
          {(WELCOME.body ?? "").split("\n\n").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStep("bottleneck")}
            className="rounded-lg bg-[#22d3ee] px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#67e8f9]"
          >
            {WELCOME.cta}
          </button>
          <Link
            href="/app/ask"
            className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-400 hover:text-slate-100"
          >
            {WELCOME.secondaryCta}
          </Link>
        </div>
        <p className="text-xs text-slate-500">{WELCOME.microcopy}</p>
      </div>
    );
  }

  if (step === "bottleneck") {
    return (
      <div className="mx-auto max-w-2xl space-y-5 py-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-100">{BOTTLENECK_PICKER.headline}</h1>
          <p className="mt-1 text-sm text-slate-400">{BOTTLENECK_PICKER.subheadline}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {BOTTLENECK_PICKER.options.map((opt) => {
            const selected = bottleneck === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setBottleneck(opt.key)}
                className={`rounded-xl border p-4 text-left transition ${
                  selected
                    ? "border-[#22d3ee] bg-[#22d3ee]/[0.08]"
                    : "border-slate-700/60 bg-slate-900/50 hover:border-slate-500"
                }`}
              >
                <div className="text-sm font-semibold text-slate-100">{opt.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{opt.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  <span className="text-slate-400">Persona:</span> {opt.persona}
                </p>
                <p className="text-xs text-slate-500">
                  <span className="text-slate-400">Apps:</span> {opt.apps}
                </p>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            disabled={!bottleneck}
            onClick={() => {
              if (bottleneck) trackEvent("first_login", { bottleneck });
              setStep("path");
            }}
            className="rounded-lg bg-[#22d3ee] px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#67e8f9] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {BOTTLENECK_PICKER.cta}
          </button>
          <p className="text-xs text-slate-500">{BOTTLENECK_PICKER.microcopy}</p>
        </div>
      </div>
    );
  }

  const startHref = bottleneck ? BOTTLENECK_DESTINATIONS[bottleneck] ?? "/app/capture" : "/app/capture";
  return (
    <div className="mx-auto max-w-xl space-y-5 py-10">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-slate-100">{SETUP_PATH.headline}</h1>
        <p className="mt-1 text-sm text-slate-400">{SETUP_PATH.subheadline}</p>
      </div>
      <ol className="space-y-2">
        {SETUP_PATH.steps.map((s, i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-900/40 px-4 py-2.5 text-sm text-slate-300"
          >
            <span className="mt-0.5 font-mono text-xs text-[#22d3ee]">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => router.push(startHref)}
          className="rounded-lg bg-[#22d3ee] px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#67e8f9]"
        >
          {SETUP_PATH.cta}
        </button>
      </div>
    </div>
  );
}
