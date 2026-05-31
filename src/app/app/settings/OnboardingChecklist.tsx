"use client";

import { useState, useEffect } from "react";

type ChecklistProps = {
  hasGithub: boolean;
  brainRepo: string | null;
  hasApiKey: boolean;
  hasShareToken: boolean;
  hasGoogleConnection: boolean;
  hasRoutines: boolean;
};

type Item = {
  id: string;
  label: string;
  detail: string | null;
  done: boolean;
  optional: boolean;
  href: string | null;
  clientControlled?: boolean;
};

const STORAGE_KEY_DISMISSED = "pa_onboarding_checklist_dismissed";
const STORAGE_KEY_HOME_SCREEN = "pa_home_screen_done";

export default function OnboardingChecklist({
  hasGithub,
  brainRepo,
  hasApiKey,
  hasShareToken,
  hasGoogleConnection,
  hasRoutines,
}: ChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [homeScreenDone, setHomeScreenDone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(localStorage.getItem(STORAGE_KEY_DISMISSED) === "1");
    setHomeScreenDone(localStorage.getItem(STORAGE_KEY_HOME_SCREEN) === "1");
  }, []);

  const items: Item[] = [
    {
      id: "github",
      label: "GitHub connected",
      detail: null,
      done: hasGithub,
      optional: false,
      href: "/api/app/auth/github?next=/app/settings",
    },
    {
      id: "brain",
      label: "Brain repo connected",
      detail: brainRepo ?? null,
      done: Boolean(brainRepo),
      optional: false,
      href: "/app/onboarding",
    },
    {
      id: "apikey",
      label: "Anthropic API key set",
      detail: null,
      done: hasApiKey,
      optional: false,
      href: "/app/settings#apikey",
    },
    {
      id: "ios",
      label: "iOS Share Setup",
      detail: null,
      done: hasShareToken,
      optional: true,
      href: "/app/share-setup",
    },
    {
      id: "google",
      label: "Google connected",
      detail: null,
      done: hasGoogleConnection,
      optional: true,
      href: "/app/settings#connections",
    },
    {
      id: "routines",
      label: "Routines enabled",
      detail: null,
      done: hasRoutines,
      optional: true,
      href: "/app/routines",
    },
    {
      id: "homescreen",
      label: "Saved as home screen app",
      detail: null,
      done: homeScreenDone,
      optional: true,
      href: null,
      clientControlled: true,
    },
  ];

  const allDone = items.every((i) => i.done);
  const requiredDone = items.filter((i) => !i.optional).every((i) => i.done);

  if (!mounted || dismissed) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY_DISMISSED, "1");
    setDismissed(true);
  }

  function markHomeScreenDone() {
    localStorage.setItem(STORAGE_KEY_HOME_SCREEN, "1");
    setHomeScreenDone(true);
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between gap-4 border-b border-slate-800/60">
        <div>
          <p className="text-sm font-semibold text-slate-100">Setup checklist</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {allDone
              ? "All set."
              : requiredDone
              ? "Core setup done — optional items below unlock more."
              : "Get the required items done first."}
          </p>
        </div>
        {allDone && (
          <button
            onClick={dismiss}
            className="shrink-0 text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors min-h-[44px] px-2"
          >
            Dismiss
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-800/40">
        {items.map((item) => (
          <div key={item.id} className="px-5 py-3 flex items-center gap-3 min-h-[52px]">
            <span
              className="shrink-0 text-[11px] w-4 text-center"
              style={{ color: item.done ? "#22d3ee" : item.optional ? "#f59e0b" : "#ef4444" }}
            >
              {item.done ? "✓" : item.optional ? "○" : "○"}
            </span>

            <div className="flex-1 min-w-0">
              <span className={`text-sm ${item.done ? "text-slate-300" : "text-slate-200"}`}>
                {item.label}
              </span>
              {item.detail && (
                <span className="ml-2 text-xs font-mono text-slate-500 truncate">
                  {item.detail}
                </span>
              )}
              {item.optional && !item.done && (
                <span className="ml-2 text-[10px] font-mono text-slate-600">optional</span>
              )}
            </div>

            {!item.done && (
              item.clientControlled ? (
                <button
                  onClick={markHomeScreenDone}
                  className="shrink-0 text-xs font-mono text-slate-400 hover:text-slate-100 border border-slate-700/60 rounded px-3 py-1.5 hover:border-slate-600 transition-all min-h-[36px]"
                >
                  Done
                </button>
              ) : item.href ? (
                <a
                  href={item.href}
                  className="shrink-0 text-xs font-mono text-[#22d3ee]/80 hover:text-[#22d3ee] transition-colors min-h-[36px] flex items-center"
                >
                  Set up →
                </a>
              ) : null
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
