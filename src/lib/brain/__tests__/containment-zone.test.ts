import { describe, it, expect } from "vitest";
import {
  ContainmentBlockedError,
  assertPathInZone,
  filterPathsToZone,
  withZone,
  withoutZone,
  type ZoneConfig,
} from "../containment-guard";

// Mirrors the per-persona zone config the create route writes: one zone per persona's
// knowledge folder, plus the shared zone. These tests cover the chat-endpoint zone-
// violation logic — the chat endpoint delegates every knowledge read to assertPathInZone
// / filterPathsToZone, so this is the guard for "a persona reads outside its zone".
const config: ZoneConfig = {
  zones: {
    "project-shared": ["projects/**", "memory/**"],
    "persona-vsm": ["personas/vsm/knowledge/**"],
    "persona-vom": ["personas/vom/knowledge/**"],
  },
};

describe("assertPathInZone", () => {
  it("allows a file inside the persona's own zone", () => {
    expect(() =>
      assertPathInZone("personas/vsm/knowledge/playbook.md", config, "persona-vsm"),
    ).not.toThrow();
  });

  it("blocks a file from another persona's zone (cross-zone read)", () => {
    expect(() =>
      assertPathInZone("personas/vom/knowledge/sop.md", config, "persona-vsm"),
    ).toThrow(ContainmentBlockedError);
  });

  it("blocks an unzoned file (fail closed)", () => {
    expect(() =>
      assertPathInZone("personal/secrets.md", config, "persona-vsm"),
    ).toThrow(ContainmentBlockedError);
  });

  it("blocks a shared-zone file when scoped to a persona zone", () => {
    expect(() =>
      assertPathInZone("projects/roadmap.md", config, "persona-vsm"),
    ).toThrow(ContainmentBlockedError);
  });

  it("carries the offending path and resolved zone on the error", () => {
    try {
      assertPathInZone("personas/vom/knowledge/sop.md", config, "persona-vsm");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ContainmentBlockedError);
      const err = e as ContainmentBlockedError;
      expect(err.path).toBe("personas/vom/knowledge/sop.md");
      expect(err.zone).toBe("persona-vom");
    }
  });
});

describe("filterPathsToZone", () => {
  it("partitions paths into the persona's zone vs everything else", () => {
    const { allowed, blocked } = filterPathsToZone(
      [
        "personas/vsm/knowledge/a.md",
        "personas/vsm/knowledge/b.md",
        "personas/vom/knowledge/c.md",
        "personal/d.md",
      ],
      config,
      "persona-vsm",
    );
    expect(allowed).toEqual(["personas/vsm/knowledge/a.md", "personas/vsm/knowledge/b.md"]);
    expect(blocked.map((b) => b.path)).toEqual(["personas/vom/knowledge/c.md", "personal/d.md"]);
  });
});

describe("withZone / withoutZone", () => {
  it("adds a zone without mutating the original config", () => {
    const next = withZone(config, "persona-vr", ["personas/vr/knowledge/**"]);
    expect(next.zones["persona-vr"]).toEqual(["personas/vr/knowledge/**"]);
    expect(config.zones["persona-vr"]).toBeUndefined();
  });

  it("removes a zone without mutating the original config", () => {
    const next = withoutZone(config, "persona-vsm");
    expect(next.zones["persona-vsm"]).toBeUndefined();
    expect(config.zones["persona-vsm"]).toBeDefined();
  });
});
