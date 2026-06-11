import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { SKOOL_URL } from "@/lib/constants/skool";

const CANONICAL_SKOOL_URL = "https://www.skool.com/aipocketagency";

// Files allowed to contain a literal `skool.com` URL: the constant itself (the single source of
// truth) and this drift-guard test (which names the canonical URL + the grep pattern).
const ALLOWED = new Set([
  "src/lib/constants/skool.ts",
  "src/lib/constants/__tests__/skool.test.ts",
]);

describe("SKOOL_URL constant", () => {
  it("defaults to the canonical aipocketagency Skool URL", () => {
    // The Skool group lives at the PLURAL "aipocketagency" slug — distinct from the website domain
    // "aipocketagent.com" (singular). An env override wins; otherwise it's the hardcoded default.
    if (process.env.NEXT_PUBLIC_SKOOL_URL) {
      expect(SKOOL_URL).toBe(process.env.NEXT_PUBLIC_SKOOL_URL);
    } else {
      expect(SKOOL_URL).toBe(CANONICAL_SKOOL_URL);
    }
  });

  it("is the only place a skool.com URL is hardcoded across src/**", () => {
    let stdout = "";
    try {
      stdout = execSync(
        "grep -rIl --include=*.ts --include=*.tsx -E 'skool\\.com' src",
        { encoding: "utf8" },
      );
    } catch (err) {
      // grep exits 1 when there are zero matches — treat that as an empty result, rethrow otherwise.
      const e = err as { status?: number; stdout?: string };
      if (e.status === 1) stdout = e.stdout ?? "";
      else throw err;
    }

    const offenders = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((file) => !ALLOWED.has(file));

    expect(offenders).toEqual([]);
  }, 60000); // recursive grep over src/** can be slow on a cold disk — give it room.
});
