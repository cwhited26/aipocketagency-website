// compose-preview.ts — the client-side matcher behind the Agent Builder hero (PA-POS-28).
// Pure keyword matching over data assembled from the real catalogs (compose-preview-data.ts):
// no LLM call, no network, purely illustrative. The real Agent Builder (PA-POS-27) composes
// against the owner's Business Brain and stages the result for approval; this preview only
// shows the shape of what it would assemble.

export type ComposeCategory =
  | "sales"
  | "content"
  | "ops"
  | "research"
  | "support"
  | "idea-mvp";

export type ComposeEntry = {
  /** Display name resolved from the real catalog — never invented. */
  name: string;
  keywords: readonly string[];
};

export type ComposeData = {
  personas: readonly ComposeEntry[];
  apps: readonly ComposeEntry[];
  skills: readonly ComposeEntry[];
  /** Fallback Persona per hero category chip when the spec text alone doesn't decide. */
  categoryPersona: Record<ComposeCategory, string>;
};

export type ComposePreview = {
  persona: string;
  apps: string[];
  skills: string[];
};

function score(spec: string, entry: ComposeEntry): number {
  let hits = 0;
  for (const keyword of entry.keywords) {
    if (spec.includes(keyword)) hits += 1;
  }
  return hits;
}

function topMatches(spec: string, entries: readonly ComposeEntry[], limit: number): string[] {
  return entries
    .map((entry) => ({ name: entry.name, hits: score(spec, entry) }))
    .filter((m) => m.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map((m) => m.name);
}

/**
 * Match a plain-English agent spec against the shipped catalogs. Returns null when the
 * spec matches nothing and no category chip is selected — the hero shows no preview
 * rather than a made-up one.
 */
export function matchSpec(
  rawSpec: string,
  category: ComposeCategory | null,
  data: ComposeData,
): ComposePreview | null {
  const spec = rawSpec.toLowerCase();

  const personaMatches = topMatches(spec, data.personas, 1);
  const apps = topMatches(spec, data.apps, 3);
  const skills = topMatches(spec, data.skills, 2);

  const persona =
    personaMatches[0] ?? (category ? data.categoryPersona[category] : undefined);
  if (!persona) return null;
  if (personaMatches.length === 0 && apps.length === 0 && skills.length === 0) return null;

  return { persona, apps, skills };
}
