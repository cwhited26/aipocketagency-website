// enrichers/clay.ts — the Clay search adapter (SPEC §3).
//
// Clay exposes people enrichment/find through its API keyed by CLAY_API_KEY. Like the Apollo adapter
// it never scrapes — it queries Clay and maps the result onto EnrichmentCandidate. No key →
// {configured:false}. The request/response mapping targets Clay's documented find-people shape; the
// per-owner connector row swaps in for the env read when that connector lands, leaving the mapping.

import type { EnrichmentCandidate, SearchParams } from "../types";
import { fetchWithTimeout, type Enricher, type EnricherResult } from "./types";

const CLAY_SEARCH_URL = "https://api.clay.com/v1/people/search";

function clayKey(): string | null {
  const k = process.env.CLAY_API_KEY;
  return k && k.length > 0 ? k : null;
}

function buildClayBody(params: SearchParams, limit: number): Record<string, unknown> {
  const body: Record<string, unknown> = { limit: Math.min(limit, 100) };
  const filters: Record<string, unknown> = {};
  if (params.title) filters.title = params.title;
  if (params.seniority) filters.seniority = params.seniority;
  if (params.location) filters.location = params.location;
  if (params.industry) filters.industry = params.industry;
  if (params.companySize) filters.company_size = params.companySize;
  const keywords = [params.keywords, params.freeText].filter(Boolean).join(" ").trim();
  if (keywords) filters.keywords = keywords;
  body.filters = filters;
  return body;
}

type ClayPerson = {
  linkedin_url?: string | null;
  full_name?: string | null;
  headline?: string | null;
  title?: string | null;
  seniority?: string | null;
  company_name?: string | null;
  industry?: string | null;
  company_size?: string | null;
  location?: string | null;
  recent_job_change?: boolean | null;
};

function mapClayPerson(p: ClayPerson): EnrichmentCandidate | null {
  const url = (p.linkedin_url ?? "").trim();
  if (!url) return null;
  return {
    linkedinProfileUrl: url,
    fullName: (p.full_name ?? "").trim(),
    headline: (p.headline ?? p.title ?? "").trim(),
    company: (p.company_name ?? "").trim(),
    signals: {
      title: p.title ?? undefined,
      seniority: p.seniority ?? undefined,
      industry: p.industry ?? undefined,
      companySize: p.company_size ?? undefined,
      location: p.location ?? undefined,
      recentJobMove: p.recent_job_change === true,
    },
    enrichmentSource: "clay",
    raw: p as unknown as Record<string, unknown>,
  };
}

export const clayEnricher: Enricher = {
  source: "clay",
  isConfigured: () => clayKey() !== null,
  async search(params: SearchParams, limit: number): Promise<EnricherResult> {
    const key = clayKey();
    if (!key) return { configured: false };

    let res: Response;
    try {
      res = await fetchWithTimeout(CLAY_SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(buildClayBody(params, limit)),
      });
    } catch (e) {
      return { configured: true, ok: false, error: e instanceof Error ? e.message : "network error" };
    }
    if (!res.ok) return { configured: true, ok: false, error: `Clay ${res.status}` };
    const json = (await res.json().catch(() => null)) as { people?: ClayPerson[]; results?: ClayPerson[] } | null;
    const people = Array.isArray(json?.people) ? json!.people : Array.isArray(json?.results) ? json!.results : [];
    const candidates = people.map(mapClayPerson).filter((c): c is EnrichmentCandidate => c !== null);
    return { configured: true, ok: true, candidates };
  },
};
