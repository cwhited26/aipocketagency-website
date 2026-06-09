import { createClient } from "@/lib/supabase/server";
import {
  listSources,
  createSourceWithProject,
  createMapsSourceWithProject,
} from "@/lib/leads/source";
import { screenUrlList } from "@/lib/leads/denylist";
import { emptyMapsFilters } from "@/lib/leads/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listSources(user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ sources: result.data });
}

const scheduleSchema = z.enum(["on_demand", "daily", "weekly"]).optional().default("on_demand");

// Phase 1 — paste a URL list.
const urlListSchema = z.object({
  kind: z.literal("url_list").optional().default("url_list"),
  name: z.string().min(1).max(120),
  extractionPattern: z.string().min(1).max(4000),
  urls: z.array(z.string().max(2000)).max(2000).optional().default([]),
  schedule: scheduleSchema,
});

// Phase 2 — Google Maps sweep. The criteria live in config_json, not a URL list.
const mapsSchema = z.object({
  kind: z.literal("google_maps"),
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(120),
  location: z.string().min(1).max(160),
  radiusMiles: z.number().int().min(1).max(100).optional().default(25),
  filters: z
    .object({
      noWebsite: z.boolean().optional().default(true),
      minReviews: z.number().int().min(0).max(100000).nullable().optional().default(null),
      maxReviews: z.number().int().min(0).max(100000).nullable().optional().default(null),
      hasPhone: z.boolean().optional().default(false),
      hasEmail: z.boolean().optional().default(false),
    })
    .optional(),
  schedule: scheduleSchema,
});

const createSchema = z.discriminatedUnion("kind", [
  urlListSchema.extend({ kind: z.literal("url_list") }),
  mapsSchema,
]);

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Default a kind-less body to url_list so Phase-1 callers keep working unchanged.
  const withKind =
    raw && typeof raw === "object" && !("kind" in raw) ? { ...raw, kind: "url_list" } : raw;
  const parsed = createSchema.safeParse(withKind);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  if (parsed.data.kind === "google_maps") {
    const result = await createMapsSourceWithProject({
      ownerId: user.id,
      name: parsed.data.name.trim(),
      config: {
        category: parsed.data.category.trim(),
        location: parsed.data.location.trim(),
        radiusMiles: parsed.data.radiusMiles,
        filters: parsed.data.filters ?? emptyMapsFilters(),
      },
      schedule: parsed.data.schedule,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ source: result.data }, { status: 201 });
  }

  // Screen the seed URLs against the denylist at create time (PA-LS-5). Any private-surface or
  // malformed URL rejects the whole create with a clear, per-URL reason so the owner fixes the list
  // rather than silently scraping or silently dropping it.
  const { ok: cleanUrls, rejected } = screenUrlList(parsed.data.urls);
  if (rejected.length > 0) {
    return NextResponse.json(
      {
        error: "Some URLs can't be scraped — fix or remove them and try again.",
        rejected,
      },
      { status: 422 },
    );
  }

  const result = await createSourceWithProject({
    ownerId: user.id,
    name: parsed.data.name.trim(),
    extractionPattern: parsed.data.extractionPattern.trim(),
    seedUrls: cleanUrls.map((u) => u.url),
    schedule: parsed.data.schedule,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ source: result.data }, { status: 201 });
}
