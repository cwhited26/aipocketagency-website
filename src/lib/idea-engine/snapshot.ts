// snapshot.ts — the Snapshot folder convention (PA-IDEA-4). Every stage writes its output into the
// owner's brain at brain/ideas/<slug>/, so the whole idea — market scan, MVP plan, build artifacts,
// sales copy, outreach batch — lives in one reusable folder the owner owns. Re-running a stage
// overwrites that stage's file; the README index links them together.
//
// Writes go through commitBrainTextFile (lib/brain/absorb.ts) — the same GitHub Contents path Lead
// Scout and the Capture Inbox use. One commit per file (commitFiles isn't exported); each write is
// best-effort and structured-logged, never throwing into the engine.

import { commitBrainTextFile } from "@/lib/brain/absorb";
import { ideaLog, errMsg } from "./log";
import { snapshotPath, type MarketScan, type Prospect } from "./types";

export type BrainCtx = { repo: string; token: string };

/** A single Snapshot file under brain/ideas/<slug>/. */
export type SnapshotFile =
  | "idea.md"
  | "market-scan.md"
  | "prospects.md"
  | "blueprint.md"
  | "prompt-pack.md"
  | "build.md"
  | "sales.md"
  | "launch.md"
  | "README.md";

export async function writeSnapshotFile(
  ctx: BrainCtx,
  slug: string,
  file: SnapshotFile,
  content: string,
): Promise<{ ok: true; sha: string } | { ok: false; error: string }> {
  const path = `${snapshotPath(slug)}/${file}`;
  try {
    const res = await commitBrainTextFile({
      repo: ctx.repo,
      token: ctx.token,
      path,
      content,
      commitMessage: `Pocket Agent — Idea Engine: ${file} for ${slug}`,
    });
    if (!res.ok) {
      ideaLog.warn("snapshot write failed", { slug, file, error: res.error });
      return { ok: false, error: res.error };
    }
    return { ok: true, sha: res.sha };
  } catch (e) {
    ideaLog.error("snapshot write threw", { slug, file, error: errMsg(e) });
    return { ok: false, error: errMsg(e) };
  }
}

// ── Markdown renderers (pure — exported for the unit test) ────────────────────────────────────────

export function renderIdeaMd(title: string, source: string, captured: string): string {
  return [
    `# ${title}`,
    "",
    `*Idea Engine Snapshot — captured via ${source}.*`,
    "",
    "## The idea",
    "",
    captured.trim() || "_(no detail captured)_",
    "",
    "---",
    "",
    "This folder is your Snapshot. Each stage of the Idea Engine writes here as it runs.",
  ].join("\n");
}

export function renderMarketScanMd(scan: MarketScan): string {
  return [
    `# Market scan — ${scan.ideaSpace}`,
    "",
    `**Vertical:** ${scan.vertical}`,
    `**Real businesses found doing this:** ${scan.competitorCount}`,
    `**Strongest competitor:** ${scan.strongestCompetitor || "—"}`,
    `**Price range seen:** ${scan.priceRange || "—"}`,
    `**Who it's for (ICP):** ${scan.icp || "—"}`,
    "",
    "## The read",
    "",
    scan.competitorCount > 0
      ? `${scan.competitorCount} businesses are already in this space. That's signal, not a stop sign — it means the demand is real. The gap to win on is execution and a sharper offer.`
      : "Nothing obvious is doing this yet. That cuts both ways — either you're early, or there's no demand. The 25 prospects below are who'd buy if it's the former.",
    "",
    `See **prospects.md** for the 25 best-fit prospects (your stage-6 outreach list).`,
  ].join("\n");
}

export function renderProspectsMd(prospects: Prospect[]): string {
  const lines = [
    `# Prospects (${prospects.length})`,
    "",
    "Best-fit businesses from the market scan. These seed the Launch stage's first 25 outreach drafts.",
    "",
    "| # | Name | Fit | Website | Contact |",
    "| - | ---- | --- | ------- | ------- |",
  ];
  prospects.forEach((p, i) => {
    lines.push(
      `| ${i + 1} | ${p.name || "—"} | ${p.fit} | ${p.website || "— none —"} | ${p.contact || "—"} |`,
    );
  });
  return lines.join("\n");
}

export function renderReadmeMd(title: string, slug: string): string {
  return [
    `# Snapshot: ${title}`,
    "",
    `\`brain/ideas/${slug}/\` — everything the Idea Engine produced for this idea.`,
    "",
    "- **idea.md** — what you dropped, and how.",
    "- **market-scan.md** — is anyone doing this, at what price, for whom.",
    "- **prospects.md** — 25 best-fit prospects.",
    "- **blueprint.md** — the MVP build plan you approved.",
    "- **prompt-pack.md** — the build prompts (prompt-pack mode).",
    "- **build.md** — the build artifacts: GitHub repo + live Vercel URL (auto-build mode).",
    "- **sales.md** — the sales copy + sales page URL.",
    "- **launch.md** — the first outreach batch + the weekly follow-up cadence.",
    "",
    "Re-run any stage, fork the idea, or archive it from the Idea Engine app.",
  ].join("\n");
}
