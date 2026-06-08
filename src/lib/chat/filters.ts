// filters.ts — the slash-command + filter system (PA v5 Wave A).
//
// One closed registry drives three things that MUST stay in sync: the left side-rail
// shortcuts, the `/`-autocomplete dropdown, and the filter applied to chat history.
// Clicking a side-rail item and typing its slash command resolve to the SAME action here,
// so there is exactly one code path for "navigate / filter / act."
//
// Pure module — no React, no DB, no env. Trivially unit-testable.

import { DEFAULT_FILTER, type FilterTag } from "./types";

// ── Command registry ────────────────────────────────────────────────────────────────────

/** What invoking a command does, beyond scoping the chat view. */
export type SlashActionKind = "filter" | "capture-voice" | "upload" | "navigate";

export type SlashCommand = {
  /** Canonical command name (without the leading slash). */
  name: string;
  /** Extra spellings that resolve to the same command. */
  aliases: readonly string[];
  /** Side-rail / autocomplete label. */
  label: string;
  /** The chat-history slice this command scopes to. */
  filterTag: FilterTag;
  /** Deep link to the standalone page (fallback + "open full page"). */
  href: string;
  /** Short one-liner for the autocomplete + help page. */
  description: string;
  /** Stable key the side rail maps to an icon. */
  iconKey: string;
  /** True when the command should appear in the left side rail. */
  inRail: boolean;
};

// Order here is the side-rail order.
export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    name: "agent",
    aliases: ["ask"],
    label: "Agent",
    filterTag: "general",
    href: "/app/ask",
    description: "Talk to your Pocket Agent",
    iconKey: "agent",
    inRail: true,
  },
  {
    name: "tasks",
    aliases: [],
    label: "Tasks",
    filterTag: "tasks",
    href: "/app/tasks",
    description: "Your action items and to-dos",
    iconKey: "tasks",
    inRail: true,
  },
  {
    name: "brain",
    aliases: ["memory"],
    label: "Brain",
    filterTag: "brain",
    href: "/app/brain",
    description: "Memory, freshness, and digests",
    iconKey: "brain",
    inRail: true,
  },
  {
    name: "documents",
    aliases: ["docs"],
    label: "Documents",
    filterTag: "docs",
    href: "/app/documents",
    description: "Browse your files",
    iconKey: "docs",
    inRail: true,
  },
  {
    name: "work",
    aliases: ["apps"],
    label: "Work",
    filterTag: "general",
    href: "/app/apps",
    description: "Quote, proposal, and email apps",
    iconKey: "work",
    inRail: true,
  },
  {
    name: "personas",
    aliases: ["persona"],
    label: "Personas",
    filterTag: "personas",
    href: "/app/personas",
    description: "Your AI team members",
    iconKey: "personas",
    inRail: true,
  },
  {
    name: "routines",
    aliases: [],
    label: "Routines",
    filterTag: "general",
    href: "/app/routines",
    description: "Scheduled automations",
    iconKey: "routines",
    inRail: true,
  },
  {
    name: "community",
    aliases: ["skool"],
    label: "Community",
    filterTag: "general",
    href: "/app/skool",
    description: "The Pocket Agent community",
    iconKey: "community",
    inRail: true,
  },
  {
    name: "capture",
    aliases: [],
    label: "Capture",
    filterTag: "capture",
    href: "/app/capture",
    description: "Feed your brain — files or voice (try /capture voice)",
    iconKey: "capture",
    inRail: true,
  },
  {
    name: "inbox",
    aliases: [],
    label: "Mission Control",
    filterTag: "inbox",
    href: "/app/mission-control",
    description: "Drafts and decisions awaiting you",
    iconKey: "inbox",
    inRail: true,
  },
  {
    name: "connections",
    aliases: ["connect"],
    label: "Connections",
    filterTag: "connections",
    href: "/app/settings/connections",
    description: "Connected accounts and integrations",
    iconKey: "connections",
    inRail: true,
  },
  {
    name: "settings",
    aliases: [],
    label: "Settings",
    filterTag: "settings",
    href: "/app/settings",
    description: "Account and app settings",
    iconKey: "settings",
    inRail: true,
  },
  // Non-rail commands.
  {
    name: "upload",
    aliases: ["file"],
    label: "Upload a file",
    filterTag: "docs",
    href: "/app/capture",
    description: "Attach a file to your chat",
    iconKey: "docs",
    inRail: false,
  },
  {
    name: "help",
    aliases: ["commands"],
    label: "Help",
    filterTag: "general",
    href: "/app/home/help",
    description: "List every slash command",
    iconKey: "settings",
    inRail: false,
  },
];

const COMMAND_BY_TOKEN: ReadonlyMap<string, SlashCommand> = (() => {
  const m = new Map<string, SlashCommand>();
  for (const cmd of SLASH_COMMANDS) {
    m.set(cmd.name, cmd);
    for (const alias of cmd.aliases) m.set(alias, cmd);
  }
  return m;
})();

/** The commands shown in the left side rail, in order. */
export function railCommands(): SlashCommand[] {
  return SLASH_COMMANDS.filter((c) => c.inRail);
}

// ── Slash parsing ───────────────────────────────────────────────────────────────────────

export type ParsedSlash = {
  command: SlashCommand;
  /** Everything after the command token, trimmed (e.g. "voice" in "/capture voice"). */
  args: string;
};

/**
 * Parses a `/<command> [args]` input. Returns null when the input is not a slash command
 * or names a command we don't know. Leading whitespace is tolerated; the command token is
 * matched case-insensitively against names + aliases.
 */
export function parseSlashCommand(input: string): ParsedSlash | null {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith("/")) return null;

  // Strip the slash, split off the first whitespace-delimited token.
  const body = trimmed.slice(1);
  const match = body.match(/^(\S+)\s*([\s\S]*)$/);
  if (!match) return null;

  const token = match[1].toLowerCase();
  const command = COMMAND_BY_TOKEN.get(token);
  if (!command) return null;

  return { command, args: match[2].trim() };
}

/** True when the raw input begins a slash command (used to gate the autocomplete). */
export function isSlashInput(input: string): boolean {
  return input.trimStart().startsWith("/");
}

/**
 * Autocomplete candidates for a partial `/xyz`. Returns all rail-eligible commands when the
 * user has typed only `/`, else commands whose name/alias starts with the partial token.
 * Caps results so the dropdown stays bounded.
 */
export function slashAutocomplete(input: string, limit = 8): SlashCommand[] {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith("/")) return [];
  // Only suggest while typing the command token itself (no space yet).
  const body = trimmed.slice(1);
  if (/\s/.test(body)) return [];

  const partial = body.toLowerCase();
  const seen = new Set<string>();
  const out: SlashCommand[] = [];
  for (const cmd of SLASH_COMMANDS) {
    if (seen.has(cmd.name)) continue;
    const tokens = [cmd.name, ...cmd.aliases];
    if (partial === "" ? cmd.inRail : tokens.some((t) => t.startsWith(partial))) {
      out.push(cmd);
      seen.add(cmd.name);
    }
    if (out.length >= limit) break;
  }
  return out;
}

// ── Action resolution ───────────────────────────────────────────────────────────────────

export type SlashAction =
  | { kind: "filter"; filter: FilterTag; command: SlashCommand }
  | { kind: "capture-voice"; command: SlashCommand }
  | { kind: "upload"; command: SlashCommand }
  | { kind: "navigate"; href: string; command: SlashCommand };

// Commands that are standalone apps with no dedicated chat slice in Wave A: clicking them
// (or typing the slash) opens the full page rather than filtering to the general stream.
const NAVIGATE_COMMANDS = new Set(["work", "routines", "community"]);

/**
 * Resolves a parsed slash command to the concrete action the UI should take. Special-cases:
 *   /capture voice → open the inline voice recorder
 *   /upload        → open the inline file picker
 *   /help          → navigate to the help page
 *   /work /routines /community → navigate to the standalone page (no chat slice in Wave A)
 * Everything else scopes the chat history to the command's filter tag.
 */
export function resolveSlashAction(parsed: ParsedSlash): SlashAction {
  const { command, args } = parsed;
  if (command.name === "capture" && args.toLowerCase() === "voice") {
    return { kind: "capture-voice", command };
  }
  if (command.name === "upload") {
    return { kind: "upload", command };
  }
  if (command.name === "help" || NAVIGATE_COMMANDS.has(command.name)) {
    return { kind: "navigate", href: command.href, command };
  }
  return { kind: "filter", filter: command.filterTag, command };
}

// ── Filter-tag matching ─────────────────────────────────────────────────────────────────

/**
 * Whether a message (by its tags) belongs in the given filter view. Mirrors the PostgREST
 * `filter_tags=cs.{tag}` (contains) query the server uses, so client + server agree.
 */
export function messageMatchesFilter(
  tags: readonly FilterTag[],
  filter: FilterTag,
): boolean {
  return tags.includes(filter);
}

/** Coerce an arbitrary string to a valid FilterTag, falling back to the default. */
export function normalizeFilter(raw: string | null | undefined): FilterTag {
  const candidate = SLASH_COMMANDS.find((c) => c.filterTag === raw)?.filterTag;
  return candidate ?? DEFAULT_FILTER;
}

// ── Natural-language intent parsing ─────────────────────────────────────────────────────
// Wave A makes existing features chat-reachable via deterministic phrase parsing — no LLM
// router. Each intent maps to a server action that emits the right inline card.

export type ChatIntent =
  | { kind: "memory"; content: string }
  | { kind: "persona"; personaQuery: string; question: string }
  | { kind: "plain"; content: string };

const MEMORY_PREFIXES = [
  /^add to memory[:\-\s]+/i,
  /^add to brain[:\-\s]+/i,
  /^remember[:\-\s]+/i,
  /^note to brain[:\-\s]+/i,
  /^save to memory[:\-\s]+/i,
];

// "ask my <persona> <question>" / "ask <persona>: <question>"
const PERSONA_RE = /^ask\s+(?:my\s+)?(.+?)\s*[:,]\s*([\s\S]+)$/i;
const PERSONA_RE_LOOSE = /^ask\s+(?:my\s+)?([\w'’\- ]{2,60}?)\s+(.+\?)\s*$/i;

/**
 * Classifies a free-text chat message into an actionable intent. Pure + deterministic so it
 * can't be steered by the message body and is fully unit-tested. Returns `plain` for
 * anything that isn't a recognized command phrase.
 */
export function parseIntent(raw: string): ChatIntent {
  const input = raw.trim();

  for (const re of MEMORY_PREFIXES) {
    if (re.test(input)) {
      const content = input.replace(re, "").trim();
      if (content.length > 0) return { kind: "memory", content };
    }
  }

  const exact = input.match(PERSONA_RE);
  if (exact) {
    const personaQuery = exact[1].trim();
    const question = exact[2].trim();
    if (personaQuery && question) return { kind: "persona", personaQuery, question };
  }
  const loose = input.match(PERSONA_RE_LOOSE);
  if (loose) {
    const personaQuery = loose[1].trim();
    const question = loose[2].trim();
    if (personaQuery && question) return { kind: "persona", personaQuery, question };
  }

  return { kind: "plain", content: input };
}
