// verticals.ts — vertical detection for the optional Domain Specialist (PA-DR-2). The fourth agent
// fires only when the question matches a vertical the owner actually has material for — voice influences
// or memory — so it's auto-routed by content match, never picked by the owner and never hallucinated
// for a vertical the brain knows nothing about.
//
// No hardcoded owner names or business specifics: the lexicon is a generic trade list, and a vertical
// fires only when BOTH the question and the owner's own brain topics reference it.

import { listDirMarkdownFiles, listMemoryFiles } from "@/lib/pa-brain";

// Generic vertical lexicon: label → trigger keywords. Matched against both the question and the owner's
// brain topics. Extend freely; nothing here is owner-specific.
const VERTICAL_LEXICON: Array<{ label: string; keywords: string[] }> = [
  { label: "roofing", keywords: ["roof", "roofing", "shingle", "reroof"] },
  { label: "HVAC", keywords: ["hvac", "furnace", "ac", "heating", "cooling", "ductwork"] },
  { label: "painting", keywords: ["paint", "painting", "repaint"] },
  { label: "general contracting", keywords: ["contractor", "contracting", "remodel", "renovation", "build"] },
  { label: "med spa", keywords: ["medspa", "med spa", "aesthetics", "botox", "filler", "skincare"] },
  { label: "law firm", keywords: ["law", "legal", "attorney", "lawyer", "litigation", "counsel"] },
  { label: "dental practice", keywords: ["dental", "dentist", "orthodontic", "hygienist"] },
  { label: "real estate", keywords: ["realtor", "listing", "brokerage", "property", "real estate"] },
  { label: "sales", keywords: ["sales", "pipeline", "prospect", "outbound", "quota", "close rate"] },
  { label: "restaurant", keywords: ["restaurant", "menu", "kitchen", "diner", "catering"] },
  { label: "fitness", keywords: ["gym", "fitness", "training", "coaching", "membership"] },
];

/** Lowercased word-boundary contains. */
function mentions(haystack: string, keyword: string): boolean {
  const re = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return re.test(haystack);
}

/**
 * Pure: returns the vertical label when the question references it AND the owner's brain topics also
 * reference it (so PA only adds a specialist for a vertical the brain has material for). null otherwise.
 * `ownerTopics` is a flat blob of the owner's influence + memory file slugs.
 */
export function matchVertical(question: string, ownerTopics: string): string | null {
  for (const v of VERTICAL_LEXICON) {
    const inQuestion = v.keywords.some((k) => mentions(question, k));
    if (!inQuestion) continue;
    const inOwner = v.keywords.some((k) => mentions(ownerTopics, k));
    if (inOwner) return v.label;
  }
  return null;
}

/**
 * Lists the owner's voice-influence + memory file names and matches the question against a vertical.
 * Returns the vertical label (→ add a Domain Specialist) or null. Never throws — a brain-read failure
 * just means no specialist this run.
 */
export async function detectVerticalForOwner(
  question: string,
  repo: string | null,
  token: string | null,
): Promise<string | null> {
  if (!repo) return null;
  try {
    const [influences, memory] = await Promise.all([
      listDirMarkdownFiles(repo, token, "voice/influences"),
      listMemoryFiles(repo, token),
    ]);
    // Build a topic blob from file names (slugs → spaced words) so the lexicon can word-match it.
    const topics = [...influences, ...memory]
      .map((f) => f.name.replace(/\.md$/, "").replace(/[-_]+/g, " "))
      .join(" ");
    return matchVertical(question, topics);
  } catch {
    return null;
  }
}
