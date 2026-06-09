import { describe, it, expect } from "vitest";
import {
  APP_CATALOG,
  APP_IDS,
  appsByIds,
  getApp,
  isAppId,
  sanitizeAppIds,
} from "../catalog";

describe("apps catalog", () => {
  it("ids are unique and match the APP_IDS tuple", () => {
    const ids = APP_CATALOG.map((a) => a.id).sort();
    expect(ids).toEqual([...APP_IDS].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every app has the fields the Apps tab and persona surface need", () => {
    for (const a of APP_CATALOG) {
      expect(a.href.startsWith("/app/")).toBe(true);
      expect(a.label).toBeTruthy();
      expect(a.shortLabel).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.blurb).toBeTruthy();
      expect(["cyan", "muted"]).toContain(a.tagColor);
    }
  });

  it("getApp + isAppId resolve known ids and reject unknown", () => {
    expect(getApp("email-drafter")?.label).toBe("Email Drafter");
    expect(getApp("nope")).toBeNull();
    expect(isAppId("lead-scout")).toBe(true);
    expect(isAppId("totally-fake")).toBe(false);
  });

  it("appsByIds drops unknown ids and is stable in catalog order", () => {
    const out = appsByIds(["brain-map", "quote", "ghost"]);
    // returned in catalog order (quote precedes brain-map), unknown dropped
    expect(out.map((a) => a.id)).toEqual(["quote", "brain-map"]);
  });

  it("sanitizeAppIds drops unknown, de-dupes, and normalizes to catalog order", () => {
    const out = sanitizeAppIds(["ghost", "brain-map", "quote", "quote"]);
    expect(out).toEqual(["quote", "brain-map"]);
  });
});
