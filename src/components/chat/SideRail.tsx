"use client";

// SideRail — the chat home's left navigation: one shortcut per rail slash command. Clicking
// an item runs the SAME resolveSlashAction path as typing the slash command, so the two are
// guaranteed equivalent. Collapses to a drawer behind a hamburger on mobile.

import { useState } from "react";
import { railCommands, resolveSlashAction, parseSlashCommand, type SlashAction } from "@/lib/chat/filters";
import type { FilterTag } from "@/lib/chat/types";
import { RailIcon, CloseIcon, HamburgerIcon } from "./icons";

export default function SideRail({
  activeFilter,
  onAction,
}: {
  activeFilter: FilterTag;
  onAction: (action: SlashAction) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const commands = railCommands();

  const handle = (cmdName: string) => {
    const parsed = parseSlashCommand(`/${cmdName}`);
    if (parsed) onAction(resolveSlashAction(parsed));
    setMobileOpen(false);
  };

  const content = (
    <>
      <div className="flex items-center h-14 px-5 border-b border-slate-800/50 shrink-0">
        <span className="text-[11px] font-mono tracking-[0.24em] text-[#22d3ee] font-semibold uppercase select-none">
          Pocket Agent
        </span>
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto text-slate-500 hover:text-slate-200 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close navigation"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5 overflow-y-auto">
        <p className="px-3 pb-2 text-[9px] font-mono uppercase tracking-[0.2em] text-slate-600">
          Type / or tap
        </p>
        {commands.map((cmd) => {
          const active = cmd.filterTag === activeFilter && cmd.name === activeFilter;
          return (
            <button
              key={cmd.name}
              onClick={() => handle(cmd.name)}
              title={`/${cmd.name} — ${cmd.description}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group text-left ${
                active
                  ? "bg-slate-800/70 text-slate-100"
                  : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/30"
              }`}
            >
              <span className={`shrink-0 transition-colors ${active ? "text-[#22d3ee]" : "text-slate-600 group-hover:text-slate-400"}`}>
                <RailIcon iconKey={cmd.iconKey} />
              </span>
              <span className="font-medium">{cmd.label}</span>
              <span className="ml-auto font-mono text-[9px] text-slate-700 group-hover:text-slate-600">
                /{cmd.name}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800/50 px-3 py-3 shrink-0">
        <a
          href="/app/home/help"
          className="block px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-200 hover:bg-slate-800/30 transition-colors font-mono"
        >
          /help — all commands
        </a>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-12 flex items-center px-4 bg-[#070c11] border-b border-slate-800/60">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate-500 hover:text-slate-200 p-2.5 -ml-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Open navigation"
        >
          <HamburgerIcon />
        </button>
        <span className="ml-3 text-[11px] font-mono tracking-[0.22em] text-[#22d3ee] font-semibold uppercase">
          Pocket Agent
        </span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-[240px] flex flex-col bg-[#070c11] border-r border-slate-800/60 h-full">
            {content}
          </aside>
        </div>
      )}

      {/* Desktop rail */}
      <aside className="hidden lg:flex w-[220px] shrink-0 flex-col bg-[#070c11] border-r border-slate-800/60 h-screen sticky top-0">
        {content}
      </aside>
    </>
  );
}
