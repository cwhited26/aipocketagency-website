// source.ts — Lead Source CRUD (pa_lead_scout_sources).
//
// A Lead Source IS a Project (PA-LS-3): creating one provisions a backing pa_projects row and stores
// the extraction pattern as that Project's Instructions, so the source's runs, seed lists, and learned
// patterns live in the Project Workspace (/app/projects/[id]) alongside everything else. The source
// row holds the scraping-specific config (kind, seed URLs, schedule) and points back at the project.
//
// Service-role PostgREST scoped by owner_id, matching pa-projects.ts.

import { createProject } from "@/lib/pa-projects";
import { nextRunFor } from "./schedule";
import type { LeadScoutSchedule, LeadScoutSource, MapsSweepConfig } from "./types";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

function readHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}
function writeHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

// The Project Instructions text we seed from a source's extraction pattern, so a conversation
// started inside the Project knows what the source is for.
function instructionsFor(name: string, extractionPattern: string): string {
  return [
    `This project backs the Lead Scout source "${name}".`,
    "",
    "When you visit a lead from this source, extract exactly this:",
    extractionPattern,
    "",
    "Stay in the owner's voice when you draft any outreach to these leads.",
  ].join("\n");
}

export async function listSources(ownerId: string): Promise<PaResult<LeadScoutSource[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_lead_scout_sources` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}&order=updated_at.desc&limit=100`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as LeadScoutSource[] };
}

export async function getSource(
  id: string,
  ownerId: string,
): Promise<PaResult<LeadScoutSource | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_lead_scout_sources` +
    `?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LeadScoutSource[];
  return { ok: true, data: rows[0] ?? null };
}

/**
 * Create a Lead Source AND its backing Project in one call. The Project's Instructions are seeded
 * from the extraction pattern. If the project create fails we still create the source (project_id
 * null) so the owner isn't blocked — the workspace link just won't resolve until they retry.
 */
export async function createSourceWithProject(params: {
  ownerId: string;
  name: string;
  extractionPattern: string;
  seedUrls: string[];
  schedule: LeadScoutSchedule;
}): Promise<PaResult<LeadScoutSource>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const project = await createProject(params.ownerId, {
    title: params.name,
    goal: `Find and qualify leads for "${params.name}".`,
    instructions: instructionsFor(params.name, params.extractionPattern),
    scaffoldSlug: null,
  });
  const projectId = project.ok ? project.data.id : null;

  const res = await fetch(`${env.url}/rest/v1/pa_lead_scout_sources`, {
    method: "POST",
    headers: writeHeaders(env.key),
    body: JSON.stringify({
      owner_id: params.ownerId,
      project_id: projectId,
      name: params.name,
      kind: "url_list",
      extraction_pattern: params.extractionPattern,
      seed_urls: params.seedUrls,
      schedule: params.schedule,
      next_run_at: nextRunFor(params.schedule),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LeadScoutSource[];
  if (!rows[0]) return { ok: false, status: 500, error: "No source row returned" };
  return { ok: true, data: rows[0] };
}

// The Project Instructions text we seed from a Google Maps sweep, so a conversation started inside
// the Project knows what the source is hunting for.
function mapsInstructionsFor(name: string, config: MapsSweepConfig): string {
  const filters: string[] = [];
  if (config.filters.noWebsite) filters.push("no real website (a Facebook page doesn't count)");
  if (config.filters.minReviews != null) filters.push(`at least ${config.filters.minReviews} reviews`);
  if (config.filters.maxReviews != null) filters.push(`no more than ${config.filters.maxReviews} reviews`);
  if (config.filters.hasPhone) filters.push("a published phone number");
  if (config.filters.hasEmail) filters.push("a published email");
  return [
    `This project backs the Lead Scout source "${name}".`,
    "",
    `It sweeps Google Maps for ${config.category} within about ${config.radiusMiles} miles of ${config.location}.`,
    filters.length ? `Keep only businesses with: ${filters.join("; ")}.` : "Keep every business found.",
    "",
    "Stay in the owner's voice when you draft any outreach to these leads.",
  ].join("\n");
}

/**
 * Create a Google Maps sweep source AND its backing Project in one call (Phase 2). The sweep criteria
 * live in config_json; extraction_pattern + seed_urls stay empty (they're url_list concepts). Mirrors
 * createSourceWithProject — the Project's Instructions are seeded from the sweep description.
 */
export async function createMapsSourceWithProject(params: {
  ownerId: string;
  name: string;
  config: MapsSweepConfig;
  schedule: LeadScoutSchedule;
}): Promise<PaResult<LeadScoutSource>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const project = await createProject(params.ownerId, {
    title: params.name,
    goal: `Find and qualify ${params.config.category} leads near ${params.config.location}.`,
    instructions: mapsInstructionsFor(params.name, params.config),
    scaffoldSlug: null,
  });
  const projectId = project.ok ? project.data.id : null;

  const res = await fetch(`${env.url}/rest/v1/pa_lead_scout_sources`, {
    method: "POST",
    headers: writeHeaders(env.key),
    body: JSON.stringify({
      owner_id: params.ownerId,
      project_id: projectId,
      name: params.name,
      kind: "google_maps",
      extraction_pattern: "",
      seed_urls: [],
      config_json: params.config,
      schedule: params.schedule,
      next_run_at: nextRunFor(params.schedule),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LeadScoutSource[];
  if (!rows[0]) return { ok: false, status: 500, error: "No source row returned" };
  return { ok: true, data: rows[0] };
}

export async function updateSource(
  id: string,
  ownerId: string,
  patch: {
    name?: string;
    extractionPattern?: string;
    seedUrls?: string[];
    schedule?: LeadScoutSchedule;
  },
): Promise<PaResult<LeadScoutSource>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.extractionPattern !== undefined) body.extraction_pattern = patch.extractionPattern;
  if (patch.seedUrls !== undefined) body.seed_urls = patch.seedUrls;
  if (patch.schedule !== undefined) {
    body.schedule = patch.schedule;
    // Re-arm (or clear) the scheduled-run cursor when the cadence changes.
    body.next_run_at = nextRunFor(patch.schedule);
  }

  const endpoint =
    `${env.url}/rest/v1/pa_lead_scout_sources` +
    `?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: writeHeaders(env.key),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LeadScoutSource[];
  if (!rows[0]) return { ok: false, status: 404, error: "Source not found" };
  return { ok: true, data: rows[0] };
}

export async function deleteSource(id: string, ownerId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_lead_scout_sources` +
    `?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`;
  const res = await fetch(endpoint, {
    method: "DELETE",
    headers: { ...readHeaders(env.key), Prefer: "return=minimal" },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
