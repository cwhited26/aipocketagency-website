// no-legacy-domain.test.ts — Phase 5C guard. The verified Resend sender domain is the 't' domain
// (aipocketagent.com); the legacy 'cy' domain (aipocketagency.com) is wrong in any sender / from /
// reply-to / mailto context across src/**. This scans the source tree for the legacy domain as an
// *email address* (i.e. with an `@` local part) and fails if one reappears. Historical mentions in
// comments — "the legacy <cy> domain is NOT canonical" — have no `@` and are intentionally allowed;
// this is a sender guard, not a copy filter.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Built from parts so this test file never contains the literal needle (it lives under src/ and is
// scanned like every other file).
const LEGACY_EMAIL_DOMAIN = `@aipocketagency${"."}com`;

const SRC_DIR = join(process.cwd(), "src");
const CODE_EXT = new Set([".ts", ".tsx"]);

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    const dot = entry.name.lastIndexOf(".");
    if (dot >= 0 && CODE_EXT.has(entry.name.slice(dot))) out.push(full);
  }
  return out;
}

describe("legacy sender domain sweep (Phase 5C)", () => {
  it("no src file uses the legacy domain in an email-address (sender/from/reply-to/mailto) context", () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(SRC_DIR)) {
      if (readFileSync(file, "utf8").includes(LEGACY_EMAIL_DOMAIN)) {
        offenders.push(file.slice(process.cwd().length + 1));
      }
    }
    expect(offenders, `legacy ${LEGACY_EMAIL_DOMAIN} sender(s) found:\n${offenders.join("\n")}`).toEqual([]);
  });
});
