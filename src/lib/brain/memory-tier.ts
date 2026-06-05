// memory-tier.ts — rules engine that classifies a new memory write into one of the
// three PAI-inspired tiers. Customer-facing UI labels these "Active work",
// "Knowledge", and "Patterns"; on disk they map to memory/work, memory/knowledge,
// and memory/learning respectively.
//
// This is intentionally a transparent rules engine, NOT an LLM call: it must be
// deterministic, instant, and auditable. The rules below are ordered by priority —
// the first tier whose signals fire wins. When nothing fires we fall back to
// KNOWLEDGE, because a durable noun-ish fact is the safest default for a long-lived
// brain (work items are transient, patterns are rare).

export type MemoryTier = "work" | "knowledge" | "learning";

export const MEMORY_TIER_FOLDER: Record<MemoryTier, string> = {
  work: "memory/work",
  knowledge: "memory/knowledge",
  learning: "memory/learning",
};

export const MEMORY_TIER_LABEL: Record<MemoryTier, string> = {
  work: "Active work",
  knowledge: "Knowledge",
  learning: "Patterns",
};

export const MEMORY_TIERS: MemoryTier[] = ["work", "knowledge", "learning"];

// ── Rule vocabularies ───────────────────────────────────────────────────────────
//
// LEARNING (Patterns) — checked FIRST because "lesson learned" language is a strong,
// rare signal that should override the otherwise-noisy work/knowledge cues. These
// are meta-patterns distilled from past work: "what we learned", reusable playbooks.
const LEARNING_PATTERNS: RegExp[] = [
  /\blessons?[\s-]+learned\b/i,
  /\bwhat\s+(?:we|i)\s+learned\b/i,
  /\bpattern\b/i,
  /\bplaybook\b/i,
  /\bretro(?:spective)?\b/i,
  /\bpost[\s-]?mortem\b/i,
  /\btakeaways?\b/i,
  /\bprinciple\b/i,
  /\brule of thumb\b/i,
  /\bbest practice\b/i,
  /\bin (?:the )?future,?\s+(?:we|i)\b/i,
  /\bnext time\b/i,
  /\bgeneraliz/i,
];

// WORK (Active work) — transient, in-flight task state: things with a status, a
// deadline, a "currently"/"in progress" framing, or a TODO/next-step shape.
const WORK_PATTERNS: RegExp[] = [
  /\b(?:todo|to-do|to do)\b/i,
  /\bnext steps?\b/i,
  /\bin progress\b/i,
  /\bin[\s-]?flight\b/i,
  /\bcurrently\b/i,
  /\bworking on\b/i,
  /\bactive task\b/i,
  /\bblocked\b/i,
  /\bblocker\b/i,
  /\bwaiting on\b/i,
  /\bdeadline\b/i,
  /\bdue (?:by|date|on)\b/i,
  /\bstatus:\s*\w+/i,
  /\bsprint\b/i,
  /\bship(?:ping)?\b/i,
  /\b(?:this|next)\s+(?:week|month|quarter)\b/i,
  /\bfollow[\s-]?up\b/i,
];

// KNOWLEDGE (Knowledge) — durable typed-graph nouns: a person, a company, a piece of
// research, an idea worth keeping. These are positive signals; KNOWLEDGE is also the
// fallback tier when neither LEARNING nor WORK fires.
const KNOWLEDGE_PATTERNS: RegExp[] = [
  /\bcompany\b/i,
  /\bclient\b/i,
  /\bcustomer\b/i,
  /\bvendor\b/i,
  /\bperson\b/i,
  /\bcontact\b/i,
  /\bresearch\b/i,
  /\bprofile\b/i,
  /\bbackground on\b/i,
  /\babout\s+the\s+\w+/i,
  /\bpricing\b/i,
  /\bproduct\b/i,
  /\bmarket\b/i,
  /\bcompetitor\b/i,
];

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const re of patterns) if (re.test(text)) n++;
  return n;
}

export type TierClassification = {
  tier: MemoryTier;
  // Why this tier was chosen — surfaced in logs/UI so the choice is auditable.
  reason: string;
};

/**
 * Classifies a new memory entry into a tier using the file name + body content.
 * Deterministic and synchronous. Priority order: LEARNING → WORK → KNOWLEDGE
 * (fallback). The name is weighted the same as the body — a file literally named
 * `todo.md` or `lessons-learned.md` is a deliberately strong signal.
 */
export function classifyMemoryTier(name: string, content: string): TierClassification {
  const haystack = `${name}\n${content}`;

  const learning = countMatches(haystack, LEARNING_PATTERNS);
  if (learning > 0) {
    return { tier: "learning", reason: `matched ${learning} pattern/lesson signal(s)` };
  }

  const work = countMatches(haystack, WORK_PATTERNS);
  const knowledge = countMatches(haystack, KNOWLEDGE_PATTERNS);

  // WORK wins ties against KNOWLEDGE: active-task language is more time-sensitive and
  // mis-filing a transient task as durable knowledge is the costlier mistake.
  if (work > 0 && work >= knowledge) {
    return { tier: "work", reason: `matched ${work} active-task signal(s)` };
  }

  if (knowledge > 0) {
    return { tier: "knowledge", reason: `matched ${knowledge} knowledge-noun signal(s)` };
  }

  return { tier: "knowledge", reason: "no strong signal — defaulted to Knowledge" };
}

/**
 * Given a proposed flat memory path (e.g. `memory/acme.md`) and the entry content,
 * returns the tiered path the new write should land at (e.g. `memory/knowledge/acme.md`).
 *
 * Only flat `memory/<file>.md` paths are rerouted. A path that already targets a tier
 * subfolder, or anything outside `memory/`, is returned unchanged — we never override
 * an explicit destination, and we never move EXISTING user memories (callers apply
 * this only to brand-new writes).
 */
export function tieredPathForNewMemory(
  proposedPath: string,
  content: string,
): { path: string; tier: MemoryTier | null; reason: string } {
  const flatMatch = /^memory\/([^/]+\.md)$/.exec(proposedPath);
  if (!flatMatch) {
    return { path: proposedPath, tier: null, reason: "path is not a flat memory/*.md write" };
  }
  const fileName = flatMatch[1];
  const { tier, reason } = classifyMemoryTier(fileName, content);
  return { path: `${MEMORY_TIER_FOLDER[tier]}/${fileName}`, tier, reason };
}

/**
 * Derives the tier of an existing file from its path. Flat `memory/*.md` files that
 * predate the tier split return null (they are "untiered" until the user moves them).
 */
export function tierFromPath(path: string): MemoryTier | null {
  const m = /^memory\/(work|knowledge|learning)\//.exec(path);
  if (!m) return null;
  return m[1] as MemoryTier;
}
