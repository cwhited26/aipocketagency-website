import { describe, it, expect } from "vitest";
import {
  ContainmentBlockedError,
  DEFAULT_ZONE_CONFIG,
  assertReadAllowed,
  partitionReadablePaths,
  parseZoneConfig,
  zoneForPath,
  isPrivateZone,
  type ZoneConfig,
} from "../containment-guard";

const config = DEFAULT_ZONE_CONFIG;

describe("zoneForPath", () => {
  it("matches files under a user-private glob", () => {
    expect(zoneForPath("personal/journal.md", config)).toBe("user-private");
    expect(zoneForPath("finance/2026/taxes.md", config)).toBe("user-private");
  });

  it("matches the bare directory itself for a /** pattern", () => {
    expect(zoneForPath("personal", config)).toBe("user-private");
  });

  it("matches project-shared globs", () => {
    expect(zoneForPath("memory/knowledge/acme.md", config)).toBe("project-shared");
    expect(zoneForPath("voice/tone.md", config)).toBe("project-shared");
    expect(zoneForPath("projects/x/SPEC.md", config)).toBe("project-shared");
  });

  it("returns null for an unzoned path", () => {
    expect(zoneForPath("README.md", config)).toBeNull();
  });

  it("normalizes a leading ./ or /", () => {
    expect(zoneForPath("/personal/x.md", config)).toBe("user-private");
    expect(zoneForPath("./finance/x.md", config)).toBe("user-private");
  });
});

describe("isPrivateZone", () => {
  it("treats project-shared as not private", () => {
    expect(isPrivateZone("project-shared")).toBe(false);
  });
  it("treats null (unzoned) as not private", () => {
    expect(isPrivateZone(null)).toBe(false);
  });
  it("fails closed for unknown zones", () => {
    expect(isPrivateZone("user-private")).toBe(true);
    expect(isPrivateZone("some-new-zone")).toBe(true);
  });
});

describe("assertReadAllowed", () => {
  it("throws ContainmentBlockedError for a private path under agent-read", () => {
    expect(() => assertReadAllowed("personal/x.md", config, "agent-read")).toThrow(
      ContainmentBlockedError,
    );
  });

  it("carries path + zone + user message on the error", () => {
    try {
      assertReadAllowed("finance/x.md", config, "agent-read");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ContainmentBlockedError);
      const err = e as ContainmentBlockedError;
      expect(err.path).toBe("finance/x.md");
      expect(err.zone).toBe("user-private");
      expect(err.userMessage).toMatch(/privacy zone/i);
    }
  });

  it("allows a private path under explicit share", () => {
    expect(() =>
      assertReadAllowed("personal/x.md", config, "user-explicit-share"),
    ).not.toThrow();
  });

  it("allows shared and unzoned paths under agent-read", () => {
    expect(() => assertReadAllowed("memory/a.md", config, "agent-read")).not.toThrow();
    expect(() => assertReadAllowed("README.md", config, "agent-read")).not.toThrow();
  });
});

describe("partitionReadablePaths", () => {
  it("splits allowed from blocked without throwing", () => {
    const { allowed, blocked } = partitionReadablePaths(
      ["memory/a.md", "personal/secret.md", "voice/t.md", "finance/q.md"],
      config,
      "agent-read",
    );
    expect(allowed).toEqual(["memory/a.md", "voice/t.md"]);
    expect(blocked.map((b) => b.path)).toEqual(["personal/secret.md", "finance/q.md"]);
    expect(blocked[0].zone).toBe("user-private");
  });

  it("allows everything under explicit share", () => {
    const { allowed, blocked } = partitionReadablePaths(
      ["personal/secret.md"],
      config,
      "user-explicit-share",
    );
    expect(allowed).toEqual(["personal/secret.md"]);
    expect(blocked).toEqual([]);
  });
});

describe("parseZoneConfig", () => {
  it("returns the default for empty/garbage input", () => {
    expect(parseZoneConfig("")).toEqual(DEFAULT_ZONE_CONFIG);
    expect(parseZoneConfig("{not json")).toEqual(DEFAULT_ZONE_CONFIG);
    expect(parseZoneConfig(JSON.stringify({ wrong: true }))).toEqual(DEFAULT_ZONE_CONFIG);
  });

  it("parses a valid custom config", () => {
    const custom: ZoneConfig = { zones: { "user-private": ["secret/**"] } };
    expect(parseZoneConfig(JSON.stringify(custom))).toEqual(custom);
  });
});
