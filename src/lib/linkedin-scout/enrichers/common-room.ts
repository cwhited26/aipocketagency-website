// enrichers/common-room.ts — the Common Room search adapter (SPEC §3).
//
// Common Room surfaces community members + their signals (recent activity, mutual context) through its
// API keyed by COMMON_ROOM_API_KEY. It never scrapes LinkedIn — it reads members the owner's Common
// Room workspace already tracks and maps them onto EnrichmentCandidate, carrying the activity signal
// the fit-scorer rewards. No key → {configured:false}. Mapping targets Common Room's documented member
// shape; the per-owner connector row swaps in for the env read when that connector lands.

import type { EnrichmentCandidate, SearchParams } from "../types";
import { fetchWithTimeout, type Enricher, type EnricherResult } from "./types";

const COMMON_ROOM_SEARCH_URL = "https://api.commonroom.io/community/v1/members/search";

function commonRoomKey(): string | null {
  const k = process.env.COMMON_ROOM_API_KEY;
  return k && k.length > 0 ? k : null;
}

function buildCommonRoomBody(params: SearchParams, limit: number): Record<string, unknown> {
  const body: Record<string, unknown> = { limit: Math.min(limit, 100) };
  const query = [params.title, params.keywords, params.freeText, params.industry]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (query) body.query = query;
  if (params.location) body.location = params.location;
  return body;
}

type CommonRoomMember = {
  linkedin_url?: string | null;
  linkedinUrl?: string | null;
  full_name?: string | null;
  name?: string | null;
  title?: string | null;
  headline?: string | null;
  organization?: string | null;
  company?: string | null;
  location?: string | null;
  has_recent_activity?: boolean | null;
  activity_count?: number | null;
};

function mapCommonRoomMember(m: CommonRoomMember): EnrichmentCandidate | null {
  const url = (m.linkedin_url ?? m.linkedinUrl ?? "").trim();
  if (!url) return null;
  const recentPost =
    m.has_recent_activity === true || (typeof m.activity_count === "number" && m.activity_count > 0);
  return {
    linkedinProfileUrl: url,
    fullName: (m.full_name ?? m.name ?? "").trim(),
    headline: (m.headline ?? m.title ?? "").trim(),
    company: (m.organization ?? m.company ?? "").trim(),
    signals: {
      title: m.title ?? undefined,
      location: m.location ?? undefined,
      recentPostActivity: recentPost,
    },
    enrichmentSource: "common_room",
    raw: m as unknown as Record<string, unknown>,
  };
}

export const commonRoomEnricher: Enricher = {
  source: "common_room",
  isConfigured: () => commonRoomKey() !== null,
  async search(params: SearchParams, limit: number): Promise<EnricherResult> {
    const key = commonRoomKey();
    if (!key) return { configured: false };

    let res: Response;
    try {
      res = await fetchWithTimeout(COMMON_ROOM_SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(buildCommonRoomBody(params, limit)),
      });
    } catch (e) {
      return { configured: true, ok: false, error: e instanceof Error ? e.message : "network error" };
    }
    if (!res.ok) return { configured: true, ok: false, error: `Common Room ${res.status}` };
    const json = (await res.json().catch(() => null)) as { members?: CommonRoomMember[]; results?: CommonRoomMember[] } | null;
    const members = Array.isArray(json?.members)
      ? json!.members
      : Array.isArray(json?.results)
        ? json!.results
        : [];
    const candidates = members
      .map(mapCommonRoomMember)
      .filter((c): c is EnrichmentCandidate => c !== null);
    return { configured: true, ok: true, candidates };
  },
};
