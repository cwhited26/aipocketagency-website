"use client";

// SlashAutocomplete — the dropdown shown above the input while the user types `/`. Driven by
// slashAutocomplete() from the shared registry, so it lists exactly the commands the parser
// will accept. Keyboard: ↑/↓ to move, Enter/Tab to pick (handled by the parent via the
// selectedIndex it passes down).

import type { SlashCommand } from "@/lib/chat/filters";
import { RailIcon } from "./icons";

export default function SlashAutocomplete({
  commands,
  selectedIndex,
  onPick,
}: {
  commands: SlashCommand[];
  selectedIndex: number;
  onPick: (cmd: SlashCommand) => void;
}) {
  if (commands.length === 0) return null;
  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 max-w-2xl mx-auto rounded-xl border border-slate-700/70 bg-[#0b1016] shadow-2xl overflow-hidden z-20">
      {commands.map((cmd, i) => (
        <button
          key={cmd.name}
          onClick={() => onPick(cmd)}
          className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${
            i === selectedIndex ? "bg-slate-800/70" : "hover:bg-slate-800/40"
          }`}
        >
          <span className="shrink-0 text-[#22d3ee]">
            <RailIcon iconKey={cmd.iconKey} />
          </span>
          <span className="font-mono text-sm text-slate-200">/{cmd.name}</span>
          <span className="text-xs text-slate-500 truncate">{cmd.description}</span>
        </button>
      ))}
    </div>
  );
}
