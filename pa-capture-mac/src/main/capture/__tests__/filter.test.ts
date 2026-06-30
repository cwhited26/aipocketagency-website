import { describe, it, expect } from "vitest";
import { shouldCaptureFromApp, normalizeAppName } from "../filter";

const NONE = { allowlist: [], denylist: [] };

describe("normalizeAppName", () => {
  it("trims and lowercases", () => {
    expect(normalizeAppName("  Safari ")).toBe("safari");
  });
  it("maps null/undefined to empty", () => {
    expect(normalizeAppName(null)).toBe("");
    expect(normalizeAppName(undefined)).toBe("");
  });
});

describe("shouldCaptureFromApp", () => {
  it("allows everything with empty lists", () => {
    expect(shouldCaptureFromApp("Safari", NONE)).toBe(true);
    expect(shouldCaptureFromApp(null, NONE)).toBe(true);
  });

  it("denies an app on the deny list (case-insensitive)", () => {
    expect(shouldCaptureFromApp("1Password", { allowlist: [], denylist: ["1password"] })).toBe(false);
  });

  it("allows apps not on the deny list", () => {
    expect(shouldCaptureFromApp("Notes", { allowlist: [], denylist: ["1Password"] })).toBe(true);
  });

  it("restricts to the allow list when one is set", () => {
    const filter = { allowlist: ["Notes", "Bear"], denylist: [] };
    expect(shouldCaptureFromApp("Notes", filter)).toBe(true);
    expect(shouldCaptureFromApp("Safari", filter)).toBe(false);
  });

  it("excludes an unknown source app while an allow list is active", () => {
    expect(shouldCaptureFromApp(null, { allowlist: ["Notes"], denylist: [] })).toBe(false);
  });

  it("lets deny win over allow for the same app", () => {
    const filter = { allowlist: ["1Password"], denylist: ["1Password"] };
    expect(shouldCaptureFromApp("1Password", filter)).toBe(false);
  });

  it("ignores blank entries in the lists", () => {
    expect(shouldCaptureFromApp("Safari", { allowlist: ["   "], denylist: [""] })).toBe(true);
  });
});
