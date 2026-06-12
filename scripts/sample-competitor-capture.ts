// sample-competitor-capture.ts — run the extraction worker locally against one URL and write the
// competitor profile + extraction log to an output directory. Dev harness for the Competitor
// Inspector (recon Lane C) — not wired into the app; run with:
//
//   npx tsx scripts/sample-competitor-capture.ts https://linear.app /tmp/sample-out
//
// Uses the local Chrome executable (PA_CHROMIUM_EXECUTABLE overrides). When ANTHROPIC_API_KEY is
// set the metered offer-summary call runs; otherwise the profile carries the structural fallback.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withPage } from "../src/lib/url-extraction/browser";
import { extractFromPage, renderExtractionLog } from "../src/lib/url-extraction/extract";
import { sourceSlugFromUrl } from "../src/lib/url-extraction/types";
import { buildCompetitorProfileMd } from "../src/lib/competitor-inspector/profile";
import { generateProfileProse, structuralFallbackProse } from "../src/lib/competitor-inspector/summary";

async function main(): Promise<void> {
  const url = process.argv[2] ?? "https://linear.app";
  const outDir = process.argv[3] ?? "/tmp/competitor-sample";
  const apiKey = process.env.ANTHROPIC_API_KEY ?? null;

  process.stderr.write(`Capturing ${url} …\n`);
  const startedAt = Date.now();
  const run = await withPage({ deadlineMs: 240_000 }, (page) => extractFromPage(page, url));
  if (!run.ok) {
    process.stderr.write(`Run failed: ${run.error}\n`);
    process.exitCode = 1;
    return;
  }
  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  const { dna, source, screenshots, log } = run.value;

  const prose = apiKey
    ? await generateProfileProse({
        apiKey,
        dna,
        source,
        cost: { ownerId: "00000000-0000-0000-0000-000000000000", featureSlug: "competitor_inspector", idempotencyKey: `sample:${Date.now()}` },
      })
    : structuralFallbackProse(dna, "sample run without a model key");

  const sourceSlug = sourceSlugFromUrl(source.final_url || url);
  const profile = buildCompetitorProfileMd({ sourceSlug, dna, source, ownerNote: "Sample capture — recon Lane C verification run", prose });

  mkdirSync(join(outDir, "screenshots"), { recursive: true });
  writeFileSync(join(outDir, "profile.md"), profile);
  writeFileSync(join(outDir, "extraction-log.md"), renderExtractionLog(log, url));
  for (const shot of screenshots) {
    writeFileSync(join(outDir, "screenshots", shot.name), Buffer.from(shot.base64, "base64"));
  }

  process.stderr.write(
    `Done in ${elapsed}s — ${log.length} log entries (${log.filter((l) => l.outcome === "failed").length} failed, ${log.filter((l) => l.outcome === "skipped").length} skipped), ` +
      `${dna.behaviors.length} behaviors, ${dna.layout.length} sections, ${screenshots.length} screenshots.\nOutput: ${outDir}\n`,
  );
}

void main();
