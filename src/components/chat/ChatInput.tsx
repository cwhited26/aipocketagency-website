"use client";

// ChatInput — the persistent, sticky-bottom chat composer. Always focusable (the parent
// focuses it when the user presses `/` anywhere). Renders the slash-command autocomplete while a
// `/command` is being typed and exposes a mic button for voice capture.
//
// Two slash systems feed one dropdown: the nav/filter registry (lib/chat/filters) and the App
// slash dispatcher (lib/apps/slash-commands). On submit the composer resolves the input against
// nav first; only when nav misses does it fall through to the App dispatcher, so `/work` (nav)
// and `/quote` (App) never fight over a token.

import { useState, type KeyboardEvent, type MutableRefObject } from "react";
import {
  isSlashInput,
  parseSlashCommand,
  resolveSlashAction,
  slashAutocomplete,
  type SlashAction,
} from "@/lib/chat/filters";
import {
  appSlashAutocomplete,
  resolveAppSlashCommand,
  type AppSlashResolution,
} from "@/lib/apps/slash-commands";
import type { AppId } from "@/lib/apps/catalog";
import type { Tier } from "@/lib/personas/tier-caps";
import SlashAutocomplete, { type SlashSuggestionItem } from "./SlashAutocomplete";
import { MicIcon, SendIcon } from "./icons";

type Suggestion = { item: SlashSuggestionItem; run: () => void };

export default function ChatInput({
  inputRef,
  tier,
  passApps = [],
  onSend,
  onSlash,
  onAppCommand,
  onMicClick,
  disabled,
}: {
  inputRef: MutableRefObject<HTMLTextAreaElement | null>;
  tier: Tier;
  /** Apps unlocked by an active Project Pass rather than the tier (PA-POS-31). */
  passApps?: readonly AppId[];
  onSend: (content: string) => void;
  onSlash: (action: SlashAction) => void;
  onAppCommand: (resolution: AppSlashResolution) => void;
  onMicClick: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState(0);

  const reset = () => {
    setValue("");
    setSelected(0);
  };

  // Build one combined suggestion list — nav commands first, then unlocked App commands — each
  // carrying the action to run when picked. The dropdown is index-driven so keyboard nav spans both.
  const suggestions: Suggestion[] = [];
  if (isSlashInput(value)) {
    const navCmds = slashAutocomplete(value);
    navCmds.forEach((cmd, i) => {
      suggestions.push({
        item: {
          token: cmd.name,
          iconKey: cmd.iconKey,
          description: cmd.description,
          groupLabel: i === 0 ? "Go to" : undefined,
        },
        run: () => {
          onSlash(resolveSlashAction({ command: cmd, args: "" }));
          reset();
          inputRef.current?.focus();
        },
      });
    });
    const appEntries = appSlashAutocomplete(value, tier, 6, passApps);
    appEntries.forEach((entry, i) => {
      suggestions.push({
        item: {
          token: entry.command,
          iconKey: "work",
          description: entry.description,
          groupLabel: i === 0 ? "Open an App" : undefined,
        },
        run: () => {
          onAppCommand(resolveAppSlashCommand(`/${entry.command}`, tier, passApps));
          reset();
        },
      });
    });
  }
  const showAutocomplete = suggestions.length > 0;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const navParsed = parseSlashCommand(trimmed);
    if (navParsed) {
      onSlash(resolveSlashAction(navParsed));
    } else if (isSlashInput(trimmed)) {
      // A slash input the nav registry didn't claim — hand it to the App dispatcher.
      onAppCommand(resolveAppSlashCommand(trimmed, tier, passApps));
    } else {
      onSend(trimmed);
    }
    reset();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => (s + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => (s - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if ((e.key === "Tab" || e.key === "Enter") && suggestions[selected]) {
        e.preventDefault();
        suggestions[selected].run();
        return;
      }
      if (e.key === "Escape") {
        reset();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="relative shrink-0 border-t border-slate-800/60 bg-[#070c11] px-3 py-3 sm:px-4 sm:py-4">
      <div className="relative max-w-2xl mx-auto">
        {showAutocomplete && (
          <SlashAutocomplete
            items={suggestions.map((s) => s.item)}
            selectedIndex={selected}
            onPick={(i) => suggestions[i]?.run()}
          />
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-slate-700/60 bg-slate-900/70 px-3 py-2 focus-within:border-[#22d3ee]/40 transition-colors">
          <button
            type="button"
            onClick={onMicClick}
            disabled={disabled}
            aria-label="Record a voice memo"
            className="shrink-0 mb-1 text-slate-500 hover:text-[#f87171] transition-colors p-1.5 disabled:opacity-40"
          >
            <MicIcon />
          </button>
          <textarea
            ref={(el) => {
              inputRef.current = el;
            }}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSelected(0);
            }}
            onKeyDown={onKeyDown}
            disabled={disabled}
            rows={1}
            placeholder="Tell Pocket Agent what you want done — or type / for commands"
            className="flex-1 resize-none bg-transparent text-sm text-slate-100 placeholder:text-slate-600 outline-none py-1.5 max-h-40 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={submit}
            disabled={disabled || value.trim().length === 0}
            aria-label="Send"
            className="shrink-0 mb-0.5 rounded-xl bg-[#22d3ee]/15 border border-[#22d3ee]/40 text-[#22d3ee] p-2 hover:bg-[#22d3ee]/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SendIcon />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] font-mono text-slate-600 hidden sm:block">
          Enter to send · Shift+Enter for newline · / for commands
        </p>
      </div>
    </div>
  );
}
