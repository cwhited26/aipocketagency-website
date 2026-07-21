// enrichers/apollo.ts — the Apollo People Search adapter (SPEC §3).
//
// Apollo's People Search (POST /v1/mixed_people/search, x-api-key auth) returns enriched people with a
// linkedin_url, title, org, and seniority — everything the fit-scorer + brief writer need, and never a
// scrape. Conditional on APOLLO_API_KEY: no key → {configured:false} (the search route degrades to the
// "connect an enrichment source" empty state). The response mapping targets Apollo's documented shape;
// when the real connector row (per-owner key) lands, swap the env read for the connection lookup — the
// candidate mapping stays.

import type { EnrichmentCandidate, SearchParams } from "../types";
import { fetchWithTimeout, type Enricher, type EnricherResult } from "./types";

const APOLLO_SEARCH_URL = "https://api.apollo.io/v1/mixed_people/search";

function apolloKey(): string | null {
  const k = process.env.APOLLO_API_KEY;
  return k && k.length > 0 ? k : null;
}

/** Map Apollo's search filters off the owner's ICP. Apollo takes arrays for most facets; a single
 *  free-text field folds into q_keywords. Only present fields are sent. */
function buildApolloBody(params: SearchParams, limit: number): Record<string, unknown> {
  const body: Record<string, unknown> = { page: 1, per_page: Math.min(limit, 100) };
  if (params.title) body.person_titles = [params.title];
  if (params.seniority) body.person_seniorities = [params.seniority.toLowerCase()];
  if (params.location) body.person_locations = [params.location];
  if (params.companySize) body.organization_num_employees_ranges = [params.companySize];
  const keywords = [params.keywords, params.freeText, params.industry].filter(Boolean).join(" ").trim();
  if (keywords) body.q_keywords = keywords;
  return body;
}

type ApolloPerson = {
  linkedin_url?: string | null;
  name?: string | null;
  title?: string | null;
  headline?: string | null;
  seniority?: string | null;
  organization?: { name?: string | null; industry?: string | null; estimated_num_employees?: number | null } | null;
  city?: string | null;
  state?: string | null;
};

function mapApolloPerson(p: ApolloPerson): EnrichmentCandidate | null {
  const url = (p.linkedin_url ?? "").trim();
  if (!url) return null; // no LinkedIn URL → not actionable for LinkedIn Scout
  const companySize =
    typeof p.organization?.estimated_num_employees === "number"
      ? String(p.organization.estimated_num_employees)
      : undefined;
  const location = [p.city, p.state].filter(Boolean).join(", ") || undefined;
  return {
    linkedinProfileUrl: url,
    fullName: (p.name ?? "").trim(),
    headline: (p.headline ?? p.title ?? "").trim(),
    company: (p.organization?.name ?? "").trim(),
    signals: {
      title: p.title ?? undefined,
      seniority: p.seniority ?? undefined,
      industry: p.organization?.industry ?? undefined,
      companySize,
      location,
    },
    enrichmentSource: "apollo",
    raw: p as unknown as Record<string, unknown>,
  };
}

export const apolloEnricher: Enricher = {
  source: "apollo",
  isConfigured: () => apolloKey() !== null,
  async search(params: SearchParams, limit: number): Promise<EnricherResult> {
    const key = apolloKey();
    if (!key) return { configured: false };

    let res: Response;
    try {
      res = await fetchWithTimeout(APOLLO_SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify(buildApolloBody(params, limit)),
      });
    } catch (e) {
      return { configured: true, ok: false, error: e instanceof Error ? e.message : "network error" };
    }
    if (!res.ok) {
      return { configured: true, ok: false, error: `Apollo ${res.status}` };
    }
    const json = (await res.json().catch(() => null)) as { people?: ApolloPerson[] } | null;
    const people = Array.isArray(json?.people) ? json!.people : [];
    const candidates = people.map(mapApolloPerson).filter((c): c is EnrichmentCandidate => c !== null);
    return { configured: true, ok: true, candidates };
  },
};
