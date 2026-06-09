// /api/cron/lead-scout — scheduled Lead Scout re-runs (Phase 3).
//
// Every 15 minutes (vercel.json) this sweeps the Lead Sources whose next_run_at is due, re-runs the
// scrape (URL-list scout or Google Maps sweep — the same pipelines the "Run now" button uses),
// auto-stages outreach for the hot + warm leads, and advances each source's schedule cursor. The
// scrape stages its usual lead_scout_batch card and the outreach stages a draft per lead, so a
// weekly source quietly fills Mission Control with new prospects + ready-to-send drafts — set it
// once, leads + drafts forever (SPEC §7.5, PA-LS-4: every outreach still stages before send).

import { NextResponse } from "next/server";
import { fetchDueLeadSources, markLeadSourceRun } from "@/lib/leads/schedule";
import { runScout } from "@/lib/leads/scout";
import { runMapsSweep } from "@/lib/leads/google-maps-sweep";
import { generateOutreachForBatch } from "@/lib/leads/outreach";
import { voiceBriefFor } from "@/lib/leads/packs";
import { screenUrlList } from "@/lib/leads/denylist";
import { resolveBrightData } from "@/lib/pa-lead-scout-connections";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { fetchPaUser } from "@/lib/pa-supabase";
import type { LeadScoutSource } from "@/lib/leads/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RunResult = {
  sourceId: string;
  name: string;
  status: "ok" | "skipped" | "error";
  reason?: string;
  leads?: number;
  drafts?: number;
};

// Run one due source end to end: scrape → auto-stage outreach. Returns the run id of a successful
// scrape (so the caller can draft outreach against it) or a skip/error reason.
async function runSource(
  source: LeadScoutSource,
): Promise<{ status: "ok" | "skipped" | "error"; reason?: string; runId?: string; leads?: number }> {
  const ownerId = source.owner_id;

  const brightData = await resolveBrightData(ownerId);
  if (!brightData.ok) return { status: "skipped", reason: brightData.error };

  const paResult = await fetchPaUser(ownerId);
  if (!paResult.ok || !paResult.data) return { status: "skipped", reason: "Account not found" };
  const paUser = paResult.data;
  if (!paUser.anthropic_api_key) return { status: "skipped", reason: "No Anthropic API key" };

  if (source.kind === "google_maps") {
    if (!source.config_json) return { status: "skipped", reason: "No sweep criteria" };
    const sweep = await runMapsSweep({
      source,
      config: source.config_json,
      ownerId,
      paUser,
      brightDataKey: brightData.apiKey,
      tier: await getCurrentTier(ownerId),
    });
    if (!sweep.ok) return { status: "error", reason: sweep.error };
    return { status: "ok", runId: sweep.run.id, leads: sweep.run.lead_count };
  }

  // url_list
  if (source.seed_urls.length === 0) return { status: "skipped", reason: "No seed URLs" };
  const { ok: cleanUrls, rejected } = screenUrlList(source.seed_urls);
  if (cleanUrls.length === 0) return { status: "skipped", reason: "All URLs denylisted" };

  const tier = await getCurrentTier(ownerId);
  const scout = await runScout({
    source,
    ownerId,
    paUser,
    brightDataKey: brightData.apiKey,
    urls: cleanUrls,
    configWarnings: rejected.map((r) => ({ url: r.url, reason: r.reason })),
    isPaid: tier !== "starter",
  });
  if (!scout.ok) return { status: "error", reason: scout.error };
  return { status: "ok", runId: scout.run.id, leads: scout.run.lead_count };
}

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueResult = await fetchDueLeadSources();
  if (!dueResult.ok) return NextResponse.json({ error: dueResult.error }, { status: 500 });

  const results: RunResult[] = [];

  for (const source of dueResult.data) {
    const ranAt = new Date();
    // Advance the cursor up front so a slow/failing source doesn't get re-picked next tick.
    await markLeadSourceRun(source.id, { schedule: source.schedule, ranAt });

    const run = await runSource(source);
    if (run.status !== "ok" || !run.runId) {
      results.push({ sourceId: source.id, name: source.name, status: run.status, reason: run.reason });
      continue;
    }

    // Auto-stage outreach for the hot + warm leads (default classification). Every draft still
    // stages for the owner's tap — nothing sends on its own (PA-LS-4).
    const paResult = await fetchPaUser(source.owner_id);
    let drafts = 0;
    if (paResult.ok && paResult.data) {
      const batch = await generateOutreachForBatch({
        runId: run.runId,
        ownerId: source.owner_id,
        paUser: paResult.data,
        sourceName: source.name,
        voiceBrief: voiceBriefFor(source.pack_slug) ?? undefined,
      });
      if (batch.ok) drafts = batch.data.staged.length;
    }

    results.push({
      sourceId: source.id,
      name: source.name,
      status: "ok",
      leads: run.leads,
      drafts,
    });
  }

  return NextResponse.json({ processed: dueResult.data.length, results });
}
