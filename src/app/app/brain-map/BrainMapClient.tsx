"use client";

import { useState } from "react";
import Mascot from "@/components/Mascot";
import GalaxyView from "./GalaxyView";
import FolderView from "./FolderView";
import { BUSINESS_BRAIN } from "@/lib/copy/in-app";

type Mode = "galaxy" | "folders";

const MODE_HINT: Record<Mode, string> = {
  galaxy: "Grouped by what it means — voice, customers, tools, decisions.",
  folders: "Grouped by where it lives — folders and the key files inside them.",
};

// Brain Map shell — owns the page chrome and the Galaxy ⇄ Folders switch, then
// hands off to the active view. Galaxy (the original, default) shows what PA knows
// grouped by meaning; Folders shows the same brain by its file structure.
export default function BrainMapClient({
  brainRepo,
  hasGithubToken,
}: {
  brainRepo: string | null;
  hasGithubToken: boolean;
}) {
  const [mode, setMode] = useState<Mode>("galaxy");

  return (
    <div className="min-h-full bg-[#06080b]">
      <div className="max-w-4xl mx-auto px-5 py-7 flex flex-col gap-4">
        <div>
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            What your agent knows
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Brain Map</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Every fact, voice cue, decision, and customer your agent has learned — laid out so you
            can see how it connects, and what&apos;s still missing.
          </p>
        </div>

        {!brainRepo ? (
          <EmptyState hasGithubToken={hasGithubToken} />
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <ModeToggle mode={mode} onChange={setMode} />
              <p className="text-xs text-slate-500">{MODE_HINT[mode]}</p>
            </div>
            {mode === "galaxy" ? (
              <GalaxyView brainRepo={brainRepo} />
            ) : (
              <FolderView brainRepo={brainRepo} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-700/60 bg-slate-800/40 p-0.5"
      role="tablist"
      aria-label="Brain Map view"
    >
      {(["galaxy", "folders"] as Mode[]).map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            mode === m
              ? "bg-[#0b1017] text-slate-100 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {m === "galaxy" ? "Galaxy" : "Folders"}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ hasGithubToken }: { hasGithubToken: boolean }) {
  const copy = BUSINESS_BRAIN.mapEmpty;
  return (
    <div className="flex flex-col items-center justify-center text-center gap-5 py-16 px-6">
      <Mascot state="documents" size={120} />
      <div className="space-y-2 max-w-sm">
        <p className="text-base font-semibold text-slate-200">{copy.headline}</p>
        {copy.subheadline && (
          <p className="text-sm text-slate-300 leading-relaxed">{copy.subheadline}</p>
        )}
        {copy.body && (
          <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{copy.body}</p>
        )}
        {!hasGithubToken ? (
          <p className="text-sm text-slate-400 leading-relaxed">
            <a
              href="/api/app/auth/github?next=/app/brain-map"
              className="text-[#22d3ee] hover:underline"
            >
              Connect GitHub →
            </a>
          </p>
        ) : (
          <p className="text-sm text-slate-400 leading-relaxed">
            <a href="/app/onboarding" className="text-[#22d3ee] hover:underline">
              {copy.cta} →
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
