"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// A "start here" affordance for a tab's empty state — an input the owner types into plus
// tappable suggestion chips that pre-fill it. On submit it hands the ask to the agent
// (/app/ask?q=…), which is where the real work kicks off, so the owner never has to leave the
// tab to begin. `framePrefix` lets a tab shape the ask (e.g. "Add a task:" / "Build me").
export function StarterBox({
  placeholder,
  submitLabel,
  chips,
  framePrefix,
  rows = 3,
}: {
  placeholder: string;
  submitLabel: string;
  chips?: string[];
  framePrefix?: string;
  rows?: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function start(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const full = framePrefix ? `${framePrefix} ${trimmed}` : trimmed;
    router.push(`/app/ask?q=${encodeURIComponent(full)}`);
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4">
      <div className="rounded-lg border border-slate-700/60 bg-slate-950/60 overflow-hidden focus-within:border-[#22d3ee]/50 transition-colors">
        <textarea
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              start(value);
            }
          }}
          className="w-full bg-transparent px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none leading-relaxed"
        />
        <div className="flex items-center justify-end px-3 py-2 border-t border-slate-800/60">
          <button
            type="button"
            onClick={() => start(value)}
            disabled={!value.trim()}
            className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[40px]"
          >
            {submitLabel}
          </button>
        </div>
      </div>

      {chips && chips.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <span className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.16em]">
            Or start from one of these
          </span>
          <div className="flex flex-col gap-1.5">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValue(c)}
                className="group flex items-start gap-3 rounded-lg border border-slate-800/50 bg-slate-950/30 px-4 py-3 text-left hover:border-slate-700/60 hover:bg-slate-800/40 transition-all min-h-[44px]"
              >
                <span className="shrink-0 text-[#22d3ee]/50 mt-0.5 text-xs">→</span>
                <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors leading-relaxed">
                  {c}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
