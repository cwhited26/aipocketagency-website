// worker.ts — the headless extraction worker entry (recon Lane C, Phase 1). One call = one run:
// row created, browser launched under a hard deadline, the recon pass executed, the row updated,
// one pa_cost_events row written (featureSlug 'url_extraction'). Isolation contract: this function
// never throws and the browser never outlives the deadline — a hung target site fails the RUN,
// not the runtime.

import { logCostFromUsage } from "@/lib/cost/log";
import { withPage } from "./browser";
import { extractFromPage, renderExtractionLog } from "./extract";
import { createExtractionRow, updateExtractionRow } from "./db";
import type { ExtractionResult } from "./types";

/** Whole-run ceiling: navigation + audit + 90s interaction budget + responsive sweep. */
const RUN_DEADLINE_MS = 240_000;

export type RunExtractionOutcome =
  | { ok: true; extractionId: string; result: ExtractionResult; elapsedSeconds: number }
  | { ok: false; extractionId: string | null; error: string };

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (!parsed.hostname.includes(".")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Run one URL extraction for an owner. Creates the pa_url_extractions row up front so the surface
 * can show the run, executes the pass under the hard deadline, and writes the outcome back.
 */
export async function runUrlExtraction(params: {
  ownerId: string;
  url: string;
  note: string | null;
}): Promise<RunExtractionOutcome> {
  const url = normalizeUrl(params.url);
  if (!url) return { ok: false, extractionId: null, error: "That doesn't look like a web address. Check it and try again." };

  const row = await createExtractionRow({ ownerId: params.ownerId, sourceUrl: url, note: params.note });
  if (!row.ok) return { ok: false, extractionId: null, error: row.error };
  const extractionId = row.data.id;

  const startedAt = Date.now();
  const run = await withPage({ deadlineMs: RUN_DEADLINE_MS }, (page) => extractFromPage(page, url));
  const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

  // Every run writes its cost row — success or failure, the compute happened. Priced as
  // serverless active-CPU (an estimate, flagged as such in the price reference).
  await logCostFromUsage(
    {
      ownerId: params.ownerId,
      featureSlug: "url_extraction",
      idempotencyKey: `url-extraction:${extractionId}`,
      metadata: { source_url: url, outcome: run.ok ? "extracted" : "failed" },
    },
    "vercel",
    null,
    { cpuSeconds: elapsedSeconds },
  );

  if (!run.ok) {
    await updateExtractionRow(extractionId, { status: "failed", error: run.error });
    console.warn("[url-extraction/worker] run failed", { extractionId, url, error: run.error });
    return { ok: false, extractionId, error: run.error };
  }

  const update = await updateExtractionRow(extractionId, {
    status: "extracted",
    extraction_log_md: renderExtractionLog(run.value.log, url),
    screenshots: run.value.screenshots,
  });
  if (!update.ok) {
    console.warn("[url-extraction/worker] extracted but row update failed", { extractionId, error: update.error });
  }

  return { ok: true, extractionId, result: run.value, elapsedSeconds };
}
