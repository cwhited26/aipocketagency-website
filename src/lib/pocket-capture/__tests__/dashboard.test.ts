import { describe, it, expect, vi, afterEach } from "vitest";
import type { InboxEntry } from "@/lib/pa-inbox";
import {
  toDashboardCapture,
  filterCaptures,
  topTags,
  paginate,
  hasMore,
  formatRelativeTime,
  debounce,
  decideCapturesView,
  type DashboardCapture,
} from "@/lib/pocket-capture/dashboard";

function cap(over: Partial<DashboardCapture>): DashboardCapture {
  return {
    id: over.id ?? "id",
    ts: over.ts ?? "2026-06-23T12:00:00.000Z",
    source: over.source ?? null,
    icon: over.icon ?? "📝",
    title: over.title ?? null,
    content: over.content ?? "",
    preview: over.preview ?? "",
    tags: over.tags ?? [],
    deleted: over.deleted ?? false,
  };
}

describe("toDashboardCapture", () => {
  it("maps an entry, reusing feed icon + preview primitives", () => {
    const entry: InboxEntry = {
      id: "u1",
      ts: "2026-06-23T12:00:00.000Z",
      kind: "sms",
      source: "sms",
      title: "Idea",
      content: "Build the thing",
      tags: ["work"],
    } as unknown as InboxEntry;
    const d = toDashboardCapture(entry);
    expect(d.icon).toBe("📱");
    expect(d.title).toBe("Idea");
    expect(d.preview).toContain("Idea — Build the thing");
    expect(d.tags).toEqual(["work"]);
    expect(d.deleted).toBe(false);
  });

  it("flags soft-deleted entries", () => {
    const entry = {
      id: "u1",
      ts: "2026-06-23T12:00:00.000Z",
      kind: "note",
      content: "x",
      deletedAt: "2026-06-23T13:00:00.000Z",
    } as unknown as InboxEntry;
    expect(toDashboardCapture(entry).deleted).toBe(true);
  });
});

describe("filterCaptures", () => {
  const list = [
    cap({ id: "a", title: "Lunch idea", content: "tacos", tags: ["food", "Work"] }),
    cap({ id: "b", title: "Standup", content: "ship the feature", tags: ["work"] }),
    cap({ id: "c", content: "random note", tags: [] }),
    cap({ id: "d", content: "deleted one", tags: ["food"], deleted: true }),
  ];

  it("substring matches title, content, and tags case-insensitively", () => {
    expect(filterCaptures(list, { query: "TACOS", tags: [] }).map((c) => c.id)).toEqual(["a"]);
    expect(filterCaptures(list, { query: "ship", tags: [] }).map((c) => c.id)).toEqual(["b"]);
    expect(filterCaptures(list, { query: "food", tags: [] }).map((c) => c.id)).toEqual(["a"]);
  });

  it("tag filter is AND-combined and case-insensitive", () => {
    expect(filterCaptures(list, { query: "", tags: ["work"] }).map((c) => c.id)).toEqual(["a", "b"]);
    expect(filterCaptures(list, { query: "", tags: ["work", "food"] }).map((c) => c.id)).toEqual(["a"]);
  });

  it("combines search AND tags", () => {
    expect(filterCaptures(list, { query: "standup", tags: ["work"] }).map((c) => c.id)).toEqual(["b"]);
    expect(filterCaptures(list, { query: "tacos", tags: ["work"] }).map((c) => c.id)).toEqual(["a"]);
  });

  it("always excludes soft-deleted captures", () => {
    expect(filterCaptures(list, { query: "deleted", tags: [] })).toEqual([]);
    expect(filterCaptures(list, { query: "", tags: ["food"] }).map((c) => c.id)).toEqual(["a"]);
  });

  it("empty filter returns all non-deleted", () => {
    expect(filterCaptures(list, { query: "", tags: [] }).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});

describe("topTags", () => {
  it("ranks by frequency then alphabetical, ignoring deleted, capped at n", () => {
    const list = [
      cap({ id: "1", tags: ["work", "food"] }),
      cap({ id: "2", tags: ["work"] }),
      cap({ id: "3", tags: ["zeta", "Food"] }),
      cap({ id: "4", tags: ["work"], deleted: true }), // ignored
    ];
    // Equal counts (work=2, food=2) tie-break alphabetically → food before work.
    expect(topTags(list, 10)).toEqual([
      { tag: "food", count: 2 },
      { tag: "work", count: 2 },
      { tag: "zeta", count: 1 },
    ]);
    expect(topTags(list, 1)).toEqual([{ tag: "food", count: 2 }]);
  });
});

describe("paginate / hasMore", () => {
  const list = Array.from({ length: 120 }, (_, i) => i);
  it("returns a cumulative window through the page (infinite scroll)", () => {
    expect(paginate(list, 1, 50)).toHaveLength(50);
    expect(paginate(list, 2, 50)).toHaveLength(100);
    expect(paginate(list, 3, 50)).toHaveLength(120);
  });
  it("clamps page and guards perPage", () => {
    expect(paginate(list, 0, 50)).toHaveLength(50);
    expect(paginate(list, 1, 0)).toEqual([]);
  });
  it("hasMore reflects remaining items", () => {
    expect(hasMore(120, 1, 50)).toBe(true);
    expect(hasMore(120, 2, 50)).toBe(true);
    expect(hasMore(120, 3, 50)).toBe(false);
    expect(hasMore(40, 1, 50)).toBe(false);
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-06-23T12:00:00.000Z");
  it("buckets recent times", () => {
    expect(formatRelativeTime("2026-06-23T11:59:50.000Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-06-23T11:58:00.000Z", now)).toBe("2 min ago");
    expect(formatRelativeTime("2026-06-23T09:00:00.000Z", now)).toBe("3 h ago");
    expect(formatRelativeTime("2026-06-21T12:00:00.000Z", now)).toBe("2 d ago");
  });
  it("falls back to an absolute date past a week", () => {
    expect(formatRelativeTime("2026-05-01T12:00:00.000Z", now)).toMatch(/May/);
  });
  it("returns empty for an unparseable timestamp", () => {
    expect(formatRelativeTime("nonsense", now)).toBe("");
  });
});

describe("debounce", () => {
  afterEach(() => vi.useRealTimers());

  it("fires once after the trailing delay, with the latest args", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const d = debounce((v: string) => spy(v), 200);
    d("a");
    d("b");
    d("c");
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(199);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("c");
  });

  it("cancel() drops a pending call", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const d = debounce(() => spy(), 200);
    d();
    d.cancel();
    vi.advanceTimersByTime(500);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("decideCapturesView (gating)", () => {
  it("logged out → login", () => {
    expect(
      decideCapturesView({ hasUser: false, hasBrain: true, isPocketCaptureBuyer: false, onboardingDone: true }),
    ).toBe("login");
  });
  it("buyer who hasn't onboarded → wizard", () => {
    expect(
      decideCapturesView({ hasUser: true, hasBrain: true, isPocketCaptureBuyer: true, onboardingDone: false }),
    ).toBe("onboarding");
  });
  it("no brain connected → empty state", () => {
    expect(
      decideCapturesView({ hasUser: true, hasBrain: false, isPocketCaptureBuyer: false, onboardingDone: true }),
    ).toBe("no-brain");
  });
  it("non-buyer with a brain → show (open to all PA users)", () => {
    expect(
      decideCapturesView({ hasUser: true, hasBrain: true, isPocketCaptureBuyer: false, onboardingDone: false }),
    ).toBe("show");
  });
  it("onboarded buyer with a brain → show", () => {
    expect(
      decideCapturesView({ hasUser: true, hasBrain: true, isPocketCaptureBuyer: true, onboardingDone: true }),
    ).toBe("show");
  });
});
