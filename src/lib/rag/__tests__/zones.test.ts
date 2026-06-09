// zones.test.ts — the cron's change-detection gate + zone-descriptor resolution (PA-RAG-8).
//
// zoneCursorChanged is the load-bearing idle-skip decision: a built zone whose source hasn't moved is
// never rebuilt (no embedding spend), a never-built zone always is, and an indeterminate current
// cursor never churns a built index. descriptorForZonePath maps a stored zone path back to the right
// shape (file vs project) so the cron reads the right source + change cursor.

import { describe, expect, it } from "vitest";
import { zoneCursorChanged, descriptorForZonePath } from "../zones";

describe("zoneCursorChanged (idle-skip gate)", () => {
  it("always builds a never-built (idle) zone", () => {
    expect(zoneCursorChanged({}, {}, true)).toBe(true);
    expect(zoneCursorChanged({ commitSha: "abc" }, { commitSha: "abc" }, true)).toBe(true);
  });

  it("skips a built file zone whose commit SHA is unchanged", () => {
    expect(zoneCursorChanged({ commitSha: "abc" }, { commitSha: "abc" }, false)).toBe(false);
  });

  it("rebuilds a built file zone whose commit SHA moved", () => {
    expect(zoneCursorChanged({ commitSha: "abc" }, { commitSha: "def" }, false)).toBe(true);
  });

  it("skips a built project zone whose newest-row timestamp is unchanged", () => {
    const ts = "2026-06-09T00:00:00Z";
    expect(zoneCursorChanged({ rowTimestamp: ts }, { rowTimestamp: ts }, false)).toBe(false);
  });

  it("rebuilds a built project zone with a newer row", () => {
    expect(
      zoneCursorChanged(
        { rowTimestamp: "2026-06-08T00:00:00Z" },
        { rowTimestamp: "2026-06-09T00:00:00Z" },
        false,
      ),
    ).toBe(true);
  });

  it("does not churn a built zone when the current cursor can't be determined", () => {
    // GitHub error / empty zone → empty cursor → treat as no change rather than rebuild.
    expect(zoneCursorChanged({ commitSha: "abc" }, {}, false)).toBe(false);
  });

  it("rebuilds a built zone that had no stored cursor once one is known", () => {
    // A 054 row migrated to an empty cursor: the first pass after this lane records it (changed=true).
    expect(zoneCursorChanged({}, { commitSha: "abc" }, false)).toBe(true);
  });
});

describe("descriptorForZonePath", () => {
  const OWNER = "11111111-1111-1111-1111-111111111111";

  it("resolves project memory/references to database-backed descriptors (no brain repo needed)", () => {
    const mem = descriptorForZonePath(OWNER, "project/p1/memory", null, null);
    expect(mem?.zoneType).toBe("project");
    expect(mem?.zonePath).toBe("project/p1/memory");

    const refs = descriptorForZonePath(OWNER, "project/p1/references", null, null);
    expect(refs?.zoneType).toBe("project");
    expect(refs?.zonePath).toBe("project/p1/references");
  });

  it("resolves brain-repo zones to file descriptors when a repo is present", () => {
    const mem = descriptorForZonePath(OWNER, "memory", "owner/brain", "tok");
    expect(mem?.zoneType).toBe("file");
    expect(mem?.zonePath).toBe("memory");

    const persona = descriptorForZonePath(OWNER, "personas/vsm/knowledge", "owner/brain", "tok");
    expect(persona?.zoneType).toBe("file");
  });

  it("returns null for a brain-repo zone when the owner has no brain repo", () => {
    expect(descriptorForZonePath(OWNER, "memory", null, null)).toBeNull();
  });
});
