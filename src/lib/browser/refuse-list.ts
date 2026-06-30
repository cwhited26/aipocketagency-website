// refuse-list.ts — the HARDCODED, non-negotiable refuse list (SPEC §"Security gates" 8 + 9).
// Pure and synchronous so it's exhaustively unit-tested. This is the last belt before a tool call
// reaches the browser: it runs BEFORE tier caps, before per-domain permissions, before any approval
// card. A refused action never runs and never stages a card — it writes one 'refused' audit row and
// stops.
//
// Two independent refuse families:
//   1. Forbidden domains (Anthropic policy) — PA must never drive *.openai.com, *.anthropic.com, or
//      their model/console subdomains, regardless of what the owner allowlists.
//   2. Financial money-movement patterns — PA will not click/type its way through a transfer or an
//      order confirmation. We match money-movement intent in the action's text surface (the target
//      URL, the selector, and any text the tool would type) against a hardcoded phrase list.
//
// The owner CANNOT override either family — there is no settings toggle that unblocks them.

import { hostOf, hostMatchesSuffix } from "./domains";

export type RefuseReason =
  | { refused: false }
  | { refused: true; family: "forbidden_domain"; detail: string }
  | { refused: true; family: "money_movement"; detail: string };

// ── 1 · Forbidden domains ────────────────────────────────────────────────────────────────────────
// Suffix match (domain or any subdomain). Hardcoded; never owner-editable.
export const FORBIDDEN_DOMAIN_SUFFIXES: readonly string[] = [
  "openai.com",
  "anthropic.com",
  "claude.ai",
];

export function isForbiddenDomain(rawUrl: string): { forbidden: boolean; detail: string } {
  const host = hostOf(rawUrl);
  if (!host) {
    // Unparseable / non-http(s) target — refuse it here too rather than hand garbage to the browser.
    return { forbidden: true, detail: `"${rawUrl.slice(0, 80)}" is not a valid http(s) URL` };
  }
  for (const suffix of FORBIDDEN_DOMAIN_SUFFIXES) {
    if (hostMatchesSuffix(host, suffix)) {
      return { forbidden: true, detail: `${host} is on the permanent forbidden-domain list (*.${suffix})` };
    }
  }
  return { forbidden: false, detail: "" };
}

// ── 2 · Financial money-movement patterns ──────────────────────────────────────────────────────────
// Phrases that signal an irreversible money movement or order commit. Matched case-insensitively as
// whole-ish phrases against the action's text surface. These are intentionally about MOVING money /
// committing an order — not merely viewing a balance or an invoice (PA pulling an AR-aging report is
// fine; PA clicking "Send Money" is not).
export const MONEY_MOVEMENT_PATTERNS: readonly string[] = [
  "send money",
  "transfer money",
  "wire transfer",
  "make a transfer",
  "make payment",
  "send payment",
  "pay now",
  "confirm order",
  "place order",
  "confirm purchase",
  "complete purchase",
  "buy now",
  "confirm payment",
  "confirm transfer",
  "withdraw",
  "checkout now",
];

function normalize(text: string): string {
  // Collapse whitespace + lowercase so "Send   Money" and "send money" match the same pattern.
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Scan the text surface of an action (the URL, the CSS selector, and any text the tool would type)
 * for a money-movement phrase. Returns the first matching phrase, or null. Pure.
 */
export function matchMoneyMovement(surfaces: readonly (string | null | undefined)[]): string | null {
  const haystack = normalize(surfaces.filter((s): s is string => !!s).join("  "));
  for (const phrase of MONEY_MOVEMENT_PATTERNS) {
    if (haystack.includes(phrase)) return phrase;
  }
  return null;
}

export type RefuseInput = {
  /** The navigation target / page URL the tool acts on. */
  url: string;
  /** CSS selector the tool targets (click/type/wait), if any. */
  selector?: string | null;
  /** Text the tool would type into an input, if any. */
  text?: string | null;
};

/**
 * The single refuse gate. Forbidden-domain wins over money-movement (it's the harder policy line and
 * gives a clearer message). Returns a structured reason the caller records on the 'refused' audit row.
 */
export function evaluateRefuse(input: RefuseInput): RefuseReason {
  const domain = isForbiddenDomain(input.url);
  if (domain.forbidden) {
    return { refused: true, family: "forbidden_domain", detail: domain.detail };
  }
  const money = matchMoneyMovement([input.url, input.selector, input.text]);
  if (money) {
    return {
      refused: true,
      family: "money_movement",
      detail: `Action matches the money-movement refuse pattern "${money}" — PA never moves money or commits an order via the browser.`,
    };
  }
  return { refused: false };
}
