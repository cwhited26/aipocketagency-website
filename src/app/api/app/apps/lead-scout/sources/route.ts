import { createClient } from "@/lib/supabase/server";
import { listSources, createSourceWithProject } from "@/lib/leads/source";
import { screenUrlList } from "@/lib/leads/denylist";
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

// Phase 1 = URL list only; kind is fixed to 'url_list'. Other kinds (Google Maps, competitor watch)
// land in later phases and aren't accepted here.
const createSchema = z.object({
  name: z.string().min(1).max(120),
  extractionPattern: z.string().min(1).max(4000),
  urls: z.array(z.string().max(2000)).max(2000).optional().default([]),
  schedule: z.enum(["on_demand", "daily", "weekly"]).optional().default("on_demand"),
});

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
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
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
