// brain-signals.ts — derive podcast-suggestion seeds from the owner's brain, with no LLM cost.
//
// Two signals, both read straight off the repo tree (listRepoTree, one call — no markdown re-parse):
//   - creators the owner already learns from  → voice/influences/<creator>/...
//   - rivals the owner already tracks          → (brain/)competitive/<rival>...
// The directory/file name IS the name; we title-case the slug. Each name is later handed to the iTunes
// Search API (itunes-search.ts) to find that person's show. Pure extraction is exported + unit-tested.

import { listRepoTree } from "@/lib/pa-brain";

export type BrainSignalKind = "creator" | "competitor";
export type BrainSignal = { name: string; kind: BrainSignalKind };

/** Title-cases a slug: "russell-brunson" → "Russell Brunson", "hormozi" → "Hormozi". */
function slugToName(slug: string): string {
  return slug
    .replace(/\.[a-z0-9]+$/i, "") // drop a file extension
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const IGNORED = new Set(["readme", "index", "_index", "notes", "overview"]);

/** Creator names from voice/influences/<creator>/… — one per distinct top directory. */
export function extractCreatorNames(paths: string[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const p of paths) {
    const m = /^voice\/influences\/([^/]+)\//.exec(p) ?? /^voice\/influences\/([^/]+)$/.exec(p);
    if (!m) continue;
    const slug = m[1].toLowerCase();
    if (IGNORED.has(slug.replace(/\.[a-z0-9]+$/i, ""))) continue;
    const name = slugToName(m[1]);
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      names.push(name);
    }
  }
  return names;
}

/** Rival names from (brain/)competitive/<rival>… — the first segment after `competitive/`. */
export function extractCompetitorNames(paths: string[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const p of paths) {
    const m = /(?:^|\/)competitive\/([^/]+)/.exec(p);
    if (!m) continue;
    const segRaw = m[1];
    const slug = segRaw.replace(/\.[a-z0-9]+$/i, "").toLowerCase();
    if (IGNORED.has(slug)) continue;
    const name = slugToName(segRaw);
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      names.push(name);
    }
  }
  return names;
}

/** Reads the owner's brain tree once and returns the creator + competitor signals (capped, deduped). */
export async function readBrainSignals(
  repo: string,
  token: string | null,
  opts: { maxPerKind?: number } = {},
): Promise<BrainSignal[]> {
  const tree = await listRepoTree(repo, token);
  const paths = tree.map((e) => e.path);
  const max = opts.maxPerKind ?? 8;
  const creators = extractCreatorNames(paths).slice(0, max).map((name) => ({ name, kind: "creator" as const }));
  const competitors = extractCompetitorNames(paths).slice(0, max).map((name) => ({ name, kind: "competitor" as const }));
  return [...competitors, ...creators];
}
