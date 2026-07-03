// Unit tests for the pa_channel_messages retention sweep (PA-CHAN-3, migration 074's plan: null
// raw_payload after 30 days, keep the row). The sweep runs against a fake PostgREST that applies
// the request's own filters (raw_payload=not.is.null + created_at=lt.<cutoff>) to an in-memory
// table — so the tests pin the real behavior (old payloads nulled, fresh rows and already-swept
// rows untouched), not just the URL shape.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHANNEL_MESSAGE_RETENTION_DAYS,
  retentionCutoffIso,
  sweepChannelMessageRetention,
} from "../retention";

// Every env var paEnv falls back through is saved/restored, so the "env unset" case can clear
// them all without leaking into other test files in the same worker.
const ENV_KEYS = [
  "POCKET_AGENT_SUPABASE_URL",
  "POCKET_AGENT_SUPABASE_SERVICE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "WC_ADMIN_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WC_ADMIN_SUPABASE_SERVICE_KEY",
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  process.env.POCKET_AGENT_SUPABASE_URL = "https://test.supabase.co";
  process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY = "service-role-key";
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

type Row = { id: string; created_at: string; raw_payload: unknown };

/** A fake PostgREST PATCH endpoint: applies the URL's raw_payload/created_at filters to `rows`,
 *  mutates the matches with the request body, and returns them (return=representation). */
function fakePostgrest(rows: Row[]): { patched: () => Row[] } {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (rawUrl: string, init: RequestInit) => {
      const url = new URL(rawUrl);
      expect(url.pathname).toBe("/rest/v1/pa_channel_messages");
      expect(init.method).toBe("PATCH");
      expect(url.searchParams.get("raw_payload")).toBe("not.is.null");
      const createdLt = url.searchParams.get("created_at");
      if (!createdLt?.startsWith("lt.")) throw new Error(`missing created_at filter: ${createdLt}`);
      const cutoff = createdLt.slice(3);
      const patch = JSON.parse(String(init.body)) as Partial<Row>;
      const matches = rows.filter((r) => r.raw_payload !== null && r.created_at < cutoff);
      for (const r of matches) Object.assign(r, patch);
      return new Response(JSON.stringify(matches.map((r) => ({ id: r.id }))), { status: 200 });
    }),
  );
  return { patched: () => rows };
}

const NOW = new Date("2026-07-02T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

describe("retentionCutoffIso", () => {
  it("is exactly 30 days before now", () => {
    expect(CHANNEL_MESSAGE_RETENTION_DAYS).toBe(30);
    expect(retentionCutoffIso(NOW)).toBe("2026-06-02T12:00:00.000Z");
  });
});

describe("sweepChannelMessageRetention", () => {
  it("nulls raw_payload on rows past retention and keeps the rows", async () => {
    const table: Row[] = [
      { id: "old-1", created_at: daysAgo(31), raw_payload: { event: "a" } },
      { id: "old-2", created_at: daysAgo(90), raw_payload: { event: "b" } },
      { id: "already-swept", created_at: daysAgo(45), raw_payload: null },
    ];
    const db = fakePostgrest(table);

    const result = await sweepChannelMessageRetention(NOW);
    expect(result).toEqual({ ok: true, swept: 2, cutoff: "2026-06-02T12:00:00.000Z" });

    const rows = db.patched();
    // Payloads pruned, rows still present — the audit trail survives the sweep.
    expect(rows.find((r) => r.id === "old-1")?.raw_payload).toBeNull();
    expect(rows.find((r) => r.id === "old-2")?.raw_payload).toBeNull();
    expect(rows).toHaveLength(3);
  });

  it("leaves fresh rows alone and is idempotent on a re-run", async () => {
    const freshPayload = { event: "fresh" };
    const table: Row[] = [
      { id: "fresh-1", created_at: daysAgo(1), raw_payload: freshPayload },
      { id: "fresh-2", created_at: daysAgo(29), raw_payload: { event: "still fresh" } },
      { id: "old-1", created_at: daysAgo(40), raw_payload: { event: "old" } },
    ];
    const db = fakePostgrest(table);

    const first = await sweepChannelMessageRetention(NOW);
    expect(first).toEqual({ ok: true, swept: 1, cutoff: "2026-06-02T12:00:00.000Z" });
    expect(db.patched().find((r) => r.id === "fresh-1")?.raw_payload).toBe(freshPayload);
    expect(db.patched().find((r) => r.id === "fresh-2")?.raw_payload).toEqual({
      event: "still fresh",
    });

    // Second run at the same instant: the only expired payload is already null → 0 swept.
    const second = await sweepChannelMessageRetention(NOW);
    expect(second).toEqual({ ok: true, swept: 0, cutoff: "2026-06-02T12:00:00.000Z" });
  });

  it("surfaces a PostgREST failure instead of swallowing it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("permission denied", { status: 403 })),
    );
    const result = await sweepChannelMessageRetention(NOW);
    expect(result).toEqual({ ok: false, status: 403, error: "permission denied" });
  });

  it("fails cleanly when the service-role env is unset", async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    const result = await sweepChannelMessageRetention(NOW);
    expect(result.ok).toBe(false);
  });
});
