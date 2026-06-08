"use client";

import { useState } from "react";
import Link from "next/link";

// Shared first-touch guide blocks used across every primary tab. The goal: a non-engineer
// business owner lands on any tab and walks away knowing what it does, what to try, and which
// other tabs it works with. Three independently-usable pieces plus a TabGuide that composes them.

export type WorksWithItem = {
  href: string;
  label: string;
  // One plain sentence: how this tab and that tab work together.
  blurb: string;
};

// "Try one of these" — copy-paste prompts. By default each one opens the Agent with the prompt
// pre-filled (/app/ask?q=). On the Agent tab itself, pass onPick to drop it into the composer.
export function TryThesePanel({
  heading = "Try one of these",
  prompts,
  onPick,
}: {
  heading?: string;
  prompts: string[];
  onPick?: (prompt: string) => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/40 px-5 py-5">
      <p className="text-sm font-medium text-slate-200">{heading}</p>
      <ul className="mt-4 flex flex-col gap-2">
        {prompts.map((p) =>
          onPick ? (
            <li key={p}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="group flex w-full items-start gap-3 rounded-lg border border-slate-800/50 bg-slate-950/30 px-4 py-3 text-left hover:border-slate-700/60 hover:bg-slate-800/40 transition-all min-h-[44px]"
              >
                <span className="shrink-0 text-[#22d3ee]/50 mt-0.5 text-xs">→</span>
                <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors leading-relaxed">
                  {p}
                </span>
              </button>
            </li>
          ) : (
            <li key={p}>
              <Link
                href={`/app/ask?q=${encodeURIComponent(p)}`}
                className="group flex items-start gap-3 rounded-lg border border-slate-800/50 bg-slate-950/30 px-4 py-3 hover:border-slate-700/60 hover:bg-slate-800/40 transition-all min-h-[44px]"
              >
                <span className="shrink-0 text-[#22d3ee]/50 mt-0.5 text-xs">→</span>
                <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors leading-relaxed">
                  {p}
                </span>
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

// "Works with…" — the 2-4 tabs this one connects to, each with a one-sentence how.
export function WorksWithPanel({ items }: { items: WorksWithItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
        Works with
      </span>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 hover:border-slate-700/60 hover:bg-slate-900 transition-all"
            >
              <span className="shrink-0 text-[#22d3ee]/60 mt-0.5 text-sm">◆</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200 group-hover:text-slate-100 transition-colors">
                  {item.label}
                </p>
                <p className="text-[13px] text-slate-500 leading-relaxed mt-0.5">{item.blurb}</p>
              </div>
              <span className="shrink-0 text-[11px] font-mono text-slate-600 group-hover:text-[#22d3ee]/70 transition-colors mt-0.5">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// "See an example" — collapsed by default so the page reads as copy first. The children are a
// realistic, non-interactive preview of what the active state looks like.
export function ExamplePanel({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-800/40 transition-colors min-h-[44px]"
      >
        <span
          className={`shrink-0 text-[#22d3ee]/70 text-xs transition-transform duration-150 ${
            open ? "rotate-90" : ""
          }`}
        >
          ▶
        </span>
        <span className="text-sm font-semibold text-slate-200">{label}</span>
        <span className="ml-auto text-[11px] font-mono text-slate-600 uppercase tracking-wider">
          {open ? "hide" : "show"}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-800/60 px-5 py-5">
          {children}
          {note && (
            <p className="mt-3 text-[11px] font-mono text-slate-600 leading-relaxed">{note}</p>
          )}
        </div>
      )}
    </div>
  );
}

// The full first-touch guide: Try one of these → Works with → See an example. Each piece is
// optional — omit prompts to drop the try-these block, omit children to drop the example.
export function TabGuide({
  prompts,
  promptsHeading,
  onPick,
  worksWith,
  exampleLabel,
  exampleNote,
  children,
}: {
  prompts?: string[];
  promptsHeading?: string;
  onPick?: (prompt: string) => void;
  worksWith: WorksWithItem[];
  exampleLabel?: string;
  exampleNote?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      {prompts && prompts.length > 0 && (
        <TryThesePanel heading={promptsHeading} prompts={prompts} onPick={onPick} />
      )}
      <WorksWithPanel items={worksWith} />
      {children && exampleLabel && (
        <ExamplePanel label={exampleLabel} note={exampleNote}>
          {children}
        </ExamplePanel>
      )}
    </div>
  );
}
