"use client";

// CardShell.tsx — the consistent frame every inline card shares: a header with an icon,
// title, filter-tag chip, timestamp, and an actions menu (archive), wrapping a card-specific
// body. Keeping the chrome here guarantees one visual language across all card kinds.

import { useState, type ReactNode } from "react";
import type { FilterTag } from "@/lib/chat/types";

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type CardShellProps = {
  title: string;
  /** Accent hex for the icon + left edge (defaults to PA cyan). */
  accent?: string;
  icon: ReactNode;
  tag: FilterTag;
  createdAt: string;
  children: ReactNode;
  /** Optional archive handler — shows the actions menu when provided. */
  onArchive?: () => void;
  /** Faded styling for Wave B placeholder cards. */
  muted?: boolean;
};

export default function CardShell({
  title,
  accent = "#22d3ee",
  icon,
  tag,
  createdAt,
  children,
  onArchive,
  muted,
}: CardShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={`rounded-xl border bg-slate-900/50 overflow-hidden ${
        muted ? "border-slate-800/50 opacity-70" : "border-slate-700/60"
      }`}
      style={{ boxShadow: `inset 3px 0 0 0 ${accent}33` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-slate-800/50">
        <span className="shrink-0" style={{ color: accent }}>
          {icon}
        </span>
        <span className="text-sm font-medium text-slate-200 truncate">{title}</span>
        <span className="ml-auto shrink-0 text-[9px] font-mono uppercase tracking-wider text-slate-500 border border-slate-800 rounded px-1.5 py-0.5">
          {tag}
        </span>
        <span className="shrink-0 text-[10px] font-mono text-slate-600 tabular-nums">
          {formatStamp(createdAt)}
        </span>
        {onArchive && (
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Card actions"
              className="text-slate-600 hover:text-slate-300 transition-colors px-1.5 leading-none text-lg"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-6 z-10 w-32 rounded-lg border border-slate-700/70 bg-[#0b1016] py-1 shadow-xl">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onArchive();
                  }}
                  className="block w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800/60"
                >
                  Archive
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}
