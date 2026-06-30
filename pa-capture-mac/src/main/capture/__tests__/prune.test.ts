import { describe, it, expect } from "vitest";
import { selectPrunableIds, DEFAULT_RETENTION_DAYS } from "../prune";

const NOW = new Date("2026-06-30T12:00:00.000Z");

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

describe("selectPrunableIds", () => {
  it("prunes synced rows older than the retention window", () => {
    const rows = [{ id: 1, synced: true, syncedAt: daysAgo(8) }];
    expect(selectPrunableIds(rows, NOW)).toEqual([1]);
  });

  it("keeps synced rows inside the retention window", () => {
    const rows = [{ id: 1, synced: true, syncedAt: daysAgo(3) }];
    expect(selectPrunableIds(rows, NOW)).toEqual([]);
  });

  it("keeps a row exactly at the boundary but prunes just past it", () => {
    const justInside = [{ id: 1, synced: true, syncedAt: daysAgo(DEFAULT_RETENTION_DAYS - 0.01) }];
    const justOutside = [{ id: 2, synced: true, syncedAt: daysAgo(DEFAULT_RETENTION_DAYS + 0.01) }];
    expect(selectPrunableIds(justInside, NOW)).toEqual([]);
    expect(selectPrunableIds(justOutside, NOW)).toEqual([2]);
  });

  it("never prunes unsynced rows even if old", () => {
    const rows = [{ id: 1, synced: false, syncedAt: null }];
    expect(selectPrunableIds(rows, NOW)).toEqual([]);
  });

  it("keeps synced rows with a missing or invalid syncedAt", () => {
    const rows = [
      { id: 1, synced: true, syncedAt: null },
      { id: 2, synced: true, syncedAt: "not-a-date" },
    ];
    expect(selectPrunableIds(rows, NOW)).toEqual([]);
  });

  it("honors a custom retention window", () => {
    const rows = [{ id: 1, synced: true, syncedAt: daysAgo(2) }];
    expect(selectPrunableIds(rows, NOW, 1)).toEqual([1]);
    expect(selectPrunableIds(rows, NOW, 30)).toEqual([]);
  });

  it("selects only the eligible ids from a mixed set", () => {
    const rows = [
      { id: 1, synced: true, syncedAt: daysAgo(10) },
      { id: 2, synced: true, syncedAt: daysAgo(1) },
      { id: 3, synced: false, syncedAt: null },
      { id: 4, synced: true, syncedAt: daysAgo(9) },
    ];
    expect(selectPrunableIds(rows, NOW)).toEqual([1, 4]);
  });
});
