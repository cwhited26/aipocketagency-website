// slash-commands.ts — the App slash dispatcher (PA-SLASH-1). Typing `/<app-slug>` in the chat
// surface opens that App pre-filled, so the owner never has to hunt the Apps grid for the thing
// they already named. Inspired by the Cortex Zero-Human / Agentic OS catalog pattern (Skool Intel
// Wave 2): the chat box is the command line for the whole agent.
//
// This sits ALONGSIDE the nav/filter slash registry (lib/chat/filters.ts). The chat composer
// resolves a `/x` input against the nav registry first; only when that misses does it fall through
// to here. So nav commands (`/work`, `/brain`) always win a token collision, and App commands fill
// in the long tail (`/quote`, `/landing-page`, `/idea-engine`).
//
// Pure module — no React, no DB, no env. The Zod schema validates the parsed command so a malformed
// token can never reach the resolver. Fully unit-tested (lib/apps/__tests__/slash-commands.test.ts).

import { z } from "zod";
import { APP_CATALOG, getApp, type AppDef, type AppId } from "./catalog";
import {
  tierAllowsAgentBuilder,
  tierAllowsBrowserAgent,
  TIER_LABELS,
  tierAllowsChannel,
  tierAllowsCompetitorInspector,
  tierAllowsIdeaEngine,
  tierAllowsLandingPageBuilder,
  tierAllowsProposalGenerator,
  tierCanSeeChannels,
  tierRank,
  type Tier,
} from "@/lib/personas/tier-caps";

// ── Zod schema for a parsed slash command ───────────────────────────────────────────────────
//
// The raw chat input form is `/<token>[ args]` matching /^\/([a-z][a-z0-9-]*)$/i on the token.
// We parse that into { command, args } and validate it here so the resolver only ever sees a
// well-formed command token.
export const appSlashCommandSchema = z.object({
  command: z.string().regex(/^[a-z][a-z0-9-]*$/i),
  args: z.string().default(""),
});
export type AppSlashCommand = z.infer<typeof appSlashCommandSchema>;

// The raw-input grammar: a leading slash, a command token, then optional inline args.
const RAW_APP_SLASH_RE = /^\/([a-z][a-z0-9-]*)(?:\s+([\s\S]+))?$/i;

/**
 * Parse a raw `/<token> [args]` chat input into a validated AppSlashCommand, or null when the
 * input is not a well-formed slash command (no leading slash, empty token, illegal token chars).
 * The parsed shape is run through appSlashCommandSchema so the contract is enforced in one place.
 */
export function parseAppSlash(input: string): AppSlashCommand | null {
  const m = input.trim().match(RAW_APP_SLASH_RE);
  if (!m) return null;
  const parsed = appSlashCommandSchema.safeParse({
    command: m[1].toLowerCase(),
    args: (m[2] ?? "").trim(),
  });
  return parsed.success ? parsed.data : null;
}

// ── Forgiving aliases ───────────────────────────────────────────────────────────────────────
//
// The canonical token for every App is its slug (AppDef.slashCommand). These are extra spellings
// that resolve to the same App — the shorthand an owner is likely to reach for. None may collide
// with a nav command (lib/chat/filters.ts) since nav wins the token first anyway, but we keep them
// distinct to avoid surprises.
const APP_SLASH_ALIASES: Readonly<Record<string, AppId>> = {
  "landing-page": "landing-page-builder",
  "landing-pages": "landing-page-builder",
  email: "email-drafter",
  "follow-up-radar": "followups",
  rituals: "ritual-scheduler",
  vault: "workflow-vault",
  ideas: "idea-engine",
  sms: "sms-channel",
  imessage: "imessage-channel",
  whatsapp: "whatsapp-channel",
};

function aliasesForApp(id: AppId): string[] {
  return Object.entries(APP_SLASH_ALIASES)
    .filter(([, target]) => target === id)
    .map(([alias]) => alias);
}

const APP_BY_TOKEN: ReadonlyMap<string, AppId> = (() => {
  const m = new Map<string, AppId>();
  for (const app of APP_CATALOG) m.set(app.slashCommand, app.id);
  for (const [alias, id] of Object.entries(APP_SLASH_ALIASES)) m.set(alias, id);
  return m;
})();

// ── Tier gating ─────────────────────────────────────────────────────────────────────────────
//
// The minimum SMB tier that unlocks each App, derived from the existing per-App gates in
// tier-caps so the two never drift. Core Apps (quote, email, brief, …) are available to every
// tier; the three build-grade Apps sit higher.
function appMinTier(appId: AppId): Tier {
  switch (appId) {
    case "landing-page-builder":
      return "studio"; // tierAllowsLandingPageBuilder
    case "competitor-inspector":
      return "pro_plus"; // tierAllowsCompetitorInspector
    case "idea-engine":
      return "pro_plus"; // tierAllowsIdeaEngine
    case "proposal-generator":
      return "pro"; // tierAllowsProposalGenerator (Business Agent+)
    case "channels":
      return "pro"; // tierCanSeeChannels (PA-CHAN-7, Business Agent+)
    case "sms-channel":
    case "whatsapp-channel":
      return "pro"; // tierAllowsChannel (Phase 2/4, Business Agent+)
    case "imessage-channel":
      return "studio_plus"; // tierAllowsChannel (Phase 3 — power-user channel)
    case "browser-agent":
      return "studio_plus"; // tierAllowsBrowserAgent (PA-POS-19 — hosted browser sessions are expensive)
    case "agent-builder":
      return "studio_plus"; // tierAllowsAgentBuilder (PA-POS-27)
    default:
      return "starter";
  }
}

/**
 * Can this tier invoke this App? Delegates to the existing per-App gates so there is a single
 * source of truth for what each tier has unlocked — a locked App is never shown in the `/`
 * popover and never opened by a slash command.
 */
export function tierAllowsApp(tier: Tier, appId: AppId, passApps: readonly AppId[] = []): boolean {
  // An active Project Pass opens its App like the tier would (PA-POS-31) — the caller resolves
  // which Apps are pass-entitled (server-side, lib/metering) and threads the ids through.
  if (passApps.includes(appId)) return true;
  switch (appId) {
    case "landing-page-builder":
      return tierAllowsLandingPageBuilder(tier);
    case "competitor-inspector":
      return tierAllowsCompetitorInspector(tier);
    case "idea-engine":
      return tierAllowsIdeaEngine(tier);
    case "proposal-generator":
      return tierAllowsProposalGenerator(tier);
    case "channels":
      return tierCanSeeChannels(tier);
    case "sms-channel":
      return tierAllowsChannel(tier, "sms");
    case "imessage-channel":
      return tierAllowsChannel(tier, "imessage");
    case "whatsapp-channel":
      return tierAllowsChannel(tier, "whatsapp");
    case "browser-agent":
      return tierAllowsBrowserAgent(tier);
    case "agent-builder":
      return tierAllowsAgentBuilder(tier);
    default:
      return tierRank(tier) >= tierRank("starter"); // every tier
  }
}

// ── Resolution ──────────────────────────────────────────────────────────────────────────────

export type AppSlashEntry = {
  /** Canonical command token (the App slug), shown as `/quote` etc. */
  command: string;
  label: string;
  description: string;
  href: string;
  appId: AppId;
};

function toEntry(app: AppDef): AppSlashEntry {
  return {
    command: app.slashCommand,
    label: app.label,
    description: app.blurb,
    href: app.href,
    appId: app.id,
  };
}

export type AppSlashResolution =
  // Bare `/` — show the popover of every App command this tier has unlocked.
  | { kind: "help"; commands: AppSlashEntry[] }
  // A known, unlocked App — open it, carrying any inline args as a prefill query param.
  | { kind: "open"; app: AppDef; args: string; href: string }
  // A known App the tier hasn't unlocked — surface the upgrade path, don't open it.
  | { kind: "locked"; app: AppDef; reason: string }
  // No App by that token — polite miss + the list of what's available.
  | { kind: "unknown"; attempted: string; commands: AppSlashEntry[] };

/** Every App command this tier has unlocked, in catalog order (the `/` popover + help list). */
export function appSlashCommandsForTier(tier: Tier, passApps: readonly AppId[] = []): AppSlashEntry[] {
  return APP_CATALOG.filter((a) => tierAllowsApp(tier, a.id, passApps)).map(toEntry);
}

function lockedReason(app: AppDef): string {
  const label = TIER_LABELS[appMinTier(app.id)];
  return `${app.label} is a ${label} App — your plan hasn't unlocked it yet. Upgrade to use /${app.slashCommand}, or browse what you have with /apps.`;
}

/**
 * Resolve a raw chat input the nav registry didn't claim into an App-slash action. Assumes the
 * caller has already confirmed the input begins with `/` (the composer checks isSlashInput first).
 * Bare `/` → help; a known unlocked App → open; a known locked App → upgrade path; anything else →
 * a polite unknown with the available list.
 */
export function resolveAppSlashCommand(
  input: string,
  tier: Tier,
  passApps: readonly AppId[] = [],
): AppSlashResolution {
  const trimmed = input.trim();
  if (trimmed === "/") return { kind: "help", commands: appSlashCommandsForTier(tier, passApps) };

  const parsed = parseAppSlash(trimmed);
  if (!parsed) {
    // A slash input whose token is malformed (e.g. "/123", "/-x"). Treat the raw token as a miss.
    const attempted = trimmed.replace(/^\/+/, "").split(/\s/, 1)[0] ?? "";
    return { kind: "unknown", attempted, commands: appSlashCommandsForTier(tier, passApps) };
  }

  const appId = APP_BY_TOKEN.get(parsed.command);
  if (!appId) {
    return { kind: "unknown", attempted: parsed.command, commands: appSlashCommandsForTier(tier, passApps) };
  }

  const app = getApp(appId);
  if (!app) {
    return { kind: "unknown", attempted: parsed.command, commands: appSlashCommandsForTier(tier, passApps) };
  }
  if (!tierAllowsApp(tier, appId, passApps)) {
    return { kind: "locked", app, reason: lockedReason(app) };
  }

  const href = parsed.args
    ? `${app.href}?prefill=${encodeURIComponent(parsed.args)}`
    : app.href;
  return { kind: "open", app, args: parsed.args, href };
}

/**
 * Autocomplete candidates for a partial `/xyz` against the App commands. Mirrors the nav
 * autocomplete: only suggests while the command token is still being typed (no space yet), lists
 * every unlocked App on bare `/`, and caps the result so the dropdown stays bounded. Locked Apps
 * are never suggested.
 */
export function appSlashAutocomplete(
  input: string,
  tier: Tier,
  limit = 6,
  passApps: readonly AppId[] = [],
): AppSlashEntry[] {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith("/")) return [];
  const body = trimmed.slice(1);
  if (/\s/.test(body)) return [];

  const partial = body.toLowerCase();
  const out: AppSlashEntry[] = [];
  for (const app of APP_CATALOG) {
    if (!tierAllowsApp(tier, app.id, passApps)) continue;
    const tokens = [app.slashCommand, ...aliasesForApp(app.id)];
    if (partial === "" || tokens.some((t) => t.startsWith(partial))) {
      out.push(toEntry(app));
    }
    if (out.length >= limit) break;
  }
  return out;
}

/** Render the available-commands list as a chat-friendly text block (unknown / help fallback). */
export function formatAppSlashList(commands: readonly AppSlashEntry[]): string {
  return commands.map((c) => `/${c.command} — ${c.description}`).join("\n");
}
