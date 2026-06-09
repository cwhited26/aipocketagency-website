#!/usr/bin/env node
// scripts/update-changelog.mjs
//
// Keeps src/content/changelog.md from silently going stale.
//
// WHY THIS IS A DRIFT DETECTOR, NOT AN AUTO-PUBLISHER:
// The changelog is read by owners — non-engineers running their business. Every
// entry has to be in plain English (see whited-brain/voice/chase-spec.md): what
// landed, what you can now do. Commit subjects are the opposite — they carry
// migration numbers, table names, and connector jargon. Scraping them straight
// into the changelog would publish exactly the slop the voice spec bans. So a
// human (or Claude) still writes each owner-facing entry by hand.
//
// What this script DOES guarantee is that no shipment slips by unnoticed: it
// reads the newest date already in the changelog, finds every commit that landed
// after it matching the `[YYYY-MM-DD] Claude Code — ...` convention, and lists
// the ones not yet reflected. Run it in CI or a pre-push hook — it exits non-zero
// when the changelog is behind, so staleness fails loudly instead of going quiet
// for two weeks.
//
// Usage:
//   node scripts/update-changelog.mjs          # report drift, exit 1 if behind
//   node scripts/update-changelog.mjs --quiet   # same, but only print on drift

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const changelogPath = join(repoRoot, "src/content/changelog.md");

const write = (line) => process.stdout.write(`${line}\n`);

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** Parse the newest `## Month DD, YYYY` heading into a Date (UTC midnight). */
function newestChangelogDate(markdown) {
  const headingRe = /^##\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/gm;
  let newest = null;
  for (const match of markdown.matchAll(headingRe)) {
    const month = MONTHS[match[1].toLowerCase()];
    if (month === undefined) continue;
    const date = new Date(Date.UTC(Number(match[3]), month, Number(match[2])));
    if (!newest || date > newest) newest = date;
  }
  return newest;
}

/** Commits after `since` whose subject matches the `[YYYY-MM-DD] Claude Code` convention. */
function commitsSince(since) {
  // `since` is the date already covered, so start the day after to avoid re-listing it.
  const sinceArg = new Date(since.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const raw = execFileSync(
    "git",
    ["log", "origin/main", `--since=${sinceArg} 00:00`, "--reverse", "--pretty=format:%h\t%s"],
    { cwd: repoRoot, encoding: "utf-8" },
  );
  const convention = /^\[(\d{4}-\d{2}-\d{2})\]\s+Claude Code\s+[—-]/;
  return raw
    .split("\n")
    .filter((line) => line.includes("\t"))
    .map((line) => {
      const [sha, ...rest] = line.split("\t");
      return { sha, subject: rest.join("\t") };
    })
    .filter((c) => convention.test(c.subject));
}

function main() {
  const quiet = process.argv.includes("--quiet");
  const markdown = readFileSync(changelogPath, "utf-8");
  const newest = newestChangelogDate(markdown);

  if (!newest) {
    write("Could not find a dated heading in changelog.md — check the file format.");
    process.exit(1);
  }

  const pending = commitsSince(newest);
  const newestLabel = newest.toISOString().slice(0, 10);

  if (pending.length === 0) {
    if (!quiet) write(`Changelog is current — newest entry is ${newestLabel}, nothing has shipped since.`);
    return;
  }

  write(`Changelog is behind. Newest entry is ${newestLabel}; ${pending.length} commit(s) shipped after it are not reflected:\n`);
  for (const c of pending) write(`  ${c.sha}  ${c.subject}`);
  write(
    "\nWrite a plain-English, owner-facing entry for each shipment in src/content/changelog.md " +
      "(newest first), then re-run this check. No SHAs, no jargon — say what landed and what the owner can now do.",
  );
  process.exit(1);
}

main();
