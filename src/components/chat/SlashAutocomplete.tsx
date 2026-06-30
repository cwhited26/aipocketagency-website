"use client";

// SlashAutocomplete — the dropdown shown above the input while the user types `/`. Driven by the
// composer, which merges two command sources into one neutral item list: the nav/filter registry
// (lib/chat/filters) and the App slash dispatcher (lib/apps/slash-commands). Each row carries only
// what the dropdown renders; the composer maps the picked index back to the right action.
// Keyboard: ↑/↓ to move, Enter/Tab to pick (handled by the parent via selectedIndex).

import { RailIcon } from "./icons";

export type SlashSuggestionItem = {
  /** The token shown after the slash. */
  token: string;
  /** Icon registry key (RailIcon). */
  iconKey: string;
  /** Short one-liner shown to the right of the token. */
  description: string;
  /** Section label rendered above this item when it opens a new group (e.g. "Apps"). */
  groupLabel?: string;
};

export default function SlashAutocomplete({
  items,
  selectedIndex,
  onPick,
}: {
  items: SlashSuggestionItem[];
  selectedIndex: number;
  onPick: (index: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 max-w-2xl mx-auto rounded-xl border border-slate-700/70 bg-[#0b1016] shadow-2xl overflow-hidden z-20">
      {items.map((item, i) => (
        <div key={`${item.token}-${i}`}>
          {item.groupLabel && (
            <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {item.groupLabel}
            </div>
          )}
          <button
            onClick={() => onPick(i)}
            className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${
              i === selectedIndex ? "bg-slate-800/70" : "hover:bg-slate-800/40"
            }`}
          >
            <span className="shrink-0 text-[#22d3ee]">
              <RailIcon iconKey={item.iconKey} />
            </span>
            <span className="font-mono text-sm text-slate-200">/{item.token}</span>
            <span className="text-xs text-slate-500 truncate">{item.description}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
