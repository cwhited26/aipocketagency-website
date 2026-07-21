// voice.ts — the shared voice scanner LinkedIn Scout drafts run through (SPEC §11, chase-spec §10).
//
// The repo had no central voice-check helper — voice rules were enforced ad hoc via regex inside a
// few tests (src/lib/leads/__tests__/packs.test.ts, src/lib/workshop/__tests__/copy.test.ts). This
// module lifts that into one reusable scanner so every LinkedIn Scout draft is checked the same way,
// and so the two-strike retry in draft.ts has a single source of truth for "is this slop?".
//
// Pure — no I/O. `scanVoiceViolations` returns the list of hits (empty = clean); `hasVoiceViolations`
// is the boolean the retry loop reads. Kept deliberately conservative: it flags the corporate/guru/
// bro tells from chase-spec's kill list, not stylistic nitpicks — a false-positive on every draft
// would defeat the two-strike retry.

/** One voice-scan hit: which rule tripped and the offending fragment, for the card's voice_flags. */
export type VoiceViolation = {
  rule: string;
  match: string;
};

// The banned-phrase kill list, straight from chase-spec §3 (corporate/hedging/guru) + §7 (hard DO-NOTs).
// Word-boundaried, case-insensitive. Each entry is (label, pattern) so a hit names the rule it broke.
const BANNED_PATTERNS: ReadonlyArray<{ rule: string; re: RegExp }> = [
  { rule: "corporate:leverage", re: /\bleverage\b/i },
  { rule: "corporate:synergy", re: /\bsynerg(y|ies)\b/i },
  { rule: "corporate:circle-back", re: /\bcircl(e|ing) back\b/i },
  { rule: "corporate:reach-out", re: /\breach(ing)? out\b/i },
  { rule: "corporate:moving-forward", re: /\bmoving forward\b/i },
  { rule: "corporate:best-practice", re: /\bbest[- ]practice/i },
  { rule: "corporate:industry-leading", re: /\bindustry[- ]leading\b/i },
  { rule: "corporate:world-class", re: /\bworld[- ]class\b/i },
  { rule: "corporate:seamless", re: /\bseamless(ly)?\b/i },
  { rule: "corporate:robust", re: /\brobust\b/i },
  { rule: "corporate:elevate", re: /\belevate\b/i },
  { rule: "hype:unlock", re: /\bunlock\b/i },
  { rule: "hype:empower", re: /\bempower\b/i },
  { rule: "hype:revolutionary", re: /\brevolutionary\b/i },
  { rule: "hype:game-changing", re: /\bgame[- ]chang(er|ing)\b/i },
  { rule: "hype:next-level", re: /\bnext[- ]level\b/i },
  { rule: "hype:cutting-edge", re: /\bcutting[- ]edge\b/i },
  { rule: "filler:genuinely", re: /\bgenuinely\b/i },
  { rule: "filler:honestly", re: /\bhonestly\b/i },
  { rule: "filler:straightforward", re: /\bstraightforward\b/i },
  { rule: "padding:hope-this-finds", re: /\bhope this (email )?finds you well\b/i },
  { rule: "padding:just-checking-in", re: /\bjust checking in\b/i },
  { rule: "padding:at-your-earliest", re: /\bat your earliest convenience\b/i },
  { rule: "guru:lets-dive-in", re: /\blet'?s dive in\b/i },
  { rule: "guru:excited-to-share", re: /\b(so |really )?excited to share\b/i },
  { rule: "bro:secret-nobody", re: /\bsecret nobody('?s)? (telling|tells)\b/i },
  { rule: "bro:dm-me", re: /\bdm me\b/i },
];

/**
 * Scan a draft for voice violations. Returns one entry per banned pattern hit (empty = clean).
 * Conservative by design — it flags the kill-list tells, not every stylistic wobble, so the
 * two-strike retry only fires on real slop.
 */
export function scanVoiceViolations(text: string): VoiceViolation[] {
  const out: VoiceViolation[] = [];
  for (const { rule, re } of BANNED_PATTERNS) {
    const m = text.match(re);
    if (m) out.push({ rule, match: m[0] });
  }
  return out;
}

/** Boolean the retry loop reads: did the draft trip any voice rule? */
export function hasVoiceViolations(text: string): boolean {
  return BANNED_PATTERNS.some(({ re }) => re.test(text));
}

/** Compact, human-readable voice_flags string for the Approval Queue card (SPEC §5 drafts column).
 *  '' when clean. Dedups by rule so one card never lists "leverage" three times. */
export function summarizeViolations(violations: VoiceViolation[]): string {
  if (violations.length === 0) return "";
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const v of violations) {
    if (seen.has(v.rule)) continue;
    seen.add(v.rule);
    parts.push(v.match);
  }
  return `voice_warning: avoid ${parts.join(", ")}`;
}
