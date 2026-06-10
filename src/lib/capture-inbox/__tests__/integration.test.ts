// End-to-end integration test for the Capture Inbox lane: five synthetic entries in memory/inbox.md
// flow through routing → triage → cleanup using the real rules/triage/cleanup code and the real
// pa-inbox parser. Only the I/O boundaries are mocked — the brain read/write, the inbox-items table,
// and the Anthropic/cost fetches — so the test exercises the actual orchestration:
//   • two entries match owner rules and are filed + pruned on capture (PA-CAPTURE-1 + 3),
//   • the remaining three are classified and staged as triage proposals (PA-CAPTURE-2),
//   • accepting one proposal files it and prunes it, leaving only the unaccepted two in the inbox.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  brain: new Map<string, string>(),
  proposals: [] as Array<{ id: string; kind: string; payload: Record<string, unknown>; status: string }>,
}));

vi.mock("@/lib/pa-brain", () => ({
  fetchFileContent: vi.fn(async (_repo: string, path: string) => h.brain.get(path) ?? null),
  commitMemoryFile: vi.fn(async (p: { path: string; content: string }) => {
    h.brain.set(p.path, p.content);
    return { ok: true, sha: "mem-sha" };
  }),
}));

vi.mock("@/lib/brain/absorb", () => ({
  commitBrainTextFile: vi.fn(async (p: { path: string; content: string }) => {
    h.brain.set(p.path, p.content);
    return { ok: true, sha: "brain-sha" };
  }),
}));

vi.mock("@/lib/pa-inbox-items", () => ({
  listInboxItems: vi.fn(async () => ({ ok: true, data: h.proposals })),
  createInboxItem: vi.fn(async (p: { kind: string; payload: Record<string, unknown> }) => {
    const item = { id: `prop-${h.proposals.length}`, kind: p.kind, payload: p.payload, status: "pending" };
    h.proposals.push(item);
    return { ok: true, data: item };
  }),
}));

import { appendEntryToRaw, parseInboxForDisplay, type InboxEntry } from "@/lib/pa-inbox";
import { applyRouting } from "../rules";
import { pruneInboxEntry } from "../cleanup";
import { runTriageForOwner, acceptTriageProposal } from "../triage";
import type { CaptureRoutingRule, CaptureTriagePayload } from "../types";

const owner = {
  id: "owner-1",
  brain_repo: "owner/brain",
  github_token: "tok",
  anthropic_api_key: "key",
};
const ctx = { repo: owner.brain_repo, token: owner.github_token };

function rule(over: Partial<CaptureRoutingRule>): CaptureRoutingRule {
  return {
    id: over.id ?? "r",
    owner_id: owner.id,
    match_pattern: over.match_pattern ?? {},
    target_path: over.target_path ?? "brain/notes",
    enabled: true,
    priority: over.priority ?? 0,
    created_at: over.created_at ?? "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
  };
}

// Map a classify request to a deterministic bucket by the note text in the prompt body.
function bucketFor(body: string): string {
  if (/review|loved/i.test(body)) return "testimonial";
  if (/accountant|reminder/i.test(body)) return "personal";
  if (/hvac|margins/i.test(body)) return "industry";
  return "unsure";
}

beforeEach(() => {
  h.brain.clear();
  h.proposals.length = 0;
  process.env.POCKET_AGENT_SUPABASE_URL = "https://test.supabase.co";
  process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY = "svc";

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes("api.anthropic.com")) {
        const word = bucketFor(String(init.body ?? ""));
        return new Response(JSON.stringify({ content: [{ type: "text", text: word }], usage: {} }), { status: 200 });
      }
      // cost-ledger insert → just succeed
      return new Response("", { status: 201 });
    }),
  );
});

afterEach(() => vi.restoreAllMocks());

describe("capture inbox — routing → triage → cleanup", () => {
  it("files matched entries on capture, triages the rest, and prunes on acceptance", async () => {
    // Build a 5-entry inbox; keep the entry objects (with ids) for the routing phase.
    const specs: Array<{ kind: InboxEntry["kind"]; content: string; sourceUrl?: string }> = [
      { kind: "url", content: "RoofClaw dropped their price to $99", sourceUrl: "https://youtube.com/watch?v=a" },
      { kind: "note", content: "A customer loved our work and left a glowing review" },
      { kind: "note", content: "Reminder: call the accountant Monday" },
      { kind: "note", content: "Thought about HVAC margins this quarter" },
      { kind: "url", content: "great pricing tactic", sourceUrl: "https://vimeo.com/123" },
    ];
    let raw = "";
    const entries: InboxEntry[] = [];
    for (const s of specs) {
      const appended = appendEntryToRaw(raw, { kind: s.kind, content: s.content, ...(s.sourceUrl ? { sourceUrl: s.sourceUrl } : {}) });
      raw = appended.content;
      entries.push(appended.entry);
    }
    h.brain.set("memory/inbox.md", raw);

    const rules = [
      rule({ id: "comp", priority: 10, match_pattern: { keywords: ["roofclaw"] }, target_path: "brain/competitive" }),
      rule({ id: "tac", priority: 5, match_pattern: { sourceUrlContains: "vimeo.com" }, target_path: "brain/tactics" }),
    ];

    // ── Phase 1: routing + cleanup on capture (simulating the share endpoint per entry) ──
    for (const entry of entries) {
      const routed = await applyRouting({ ctx, entry, rules });
      if (routed.routed) {
        await pruneInboxEntry({ ctx, entryId: entry.id, targets: [{ path: routed.path, requireSignature: true }] });
      }
    }

    // Entries 1 + 5 routed and pruned; 2/3/4 remain.
    const afterRouting = parseInboxForDisplay(h.brain.get("memory/inbox.md") ?? "");
    expect(afterRouting.map((e) => e.id).sort()).toEqual([entries[1].id, entries[2].id, entries[3].id].sort());
    expect([...h.brain.keys()].some((k) => k.startsWith("brain/competitive/"))).toBe(true);
    expect([...h.brain.keys()].some((k) => k.startsWith("brain/tactics/"))).toBe(true);

    // ── Phase 2: triage sweep over what's left ──
    const swept = await runTriageForOwner(owner);
    expect(swept.entriesSeen).toBe(3);
    expect(swept.staged).toBe(3);
    expect(h.proposals).toHaveLength(3);

    // ── Phase 3: accept the testimonial proposal → file + prune ──
    const testimonialProp = h.proposals.find(
      (p) => (p.payload as unknown as CaptureTriagePayload).entryId === entries[1].id,
    );
    expect(testimonialProp).toBeTruthy();
    const payload = testimonialProp!.payload as unknown as CaptureTriagePayload;
    expect(payload.bucket).toBe("testimonial");

    const accepted = await acceptTriageProposal({ ctx, payload });
    expect(accepted.ok).toBe(true);
    expect([...h.brain.keys()].some((k) => k.startsWith("brain/testimonials/"))).toBe(true);

    // Final inbox holds only the two unaccepted entries (the personal + the industry note).
    const finalInbox = parseInboxForDisplay(h.brain.get("memory/inbox.md") ?? "");
    expect(finalInbox.map((e) => e.id).sort()).toEqual([entries[2].id, entries[3].id].sort());
  });

  it("a second triage sweep does not re-propose already-proposed entries", async () => {
    const { content: raw, entry } = appendEntryToRaw("", { kind: "note", content: "Reminder: call the accountant" });
    h.brain.set("memory/inbox.md", raw);

    const first = await runTriageForOwner(owner);
    expect(first.staged).toBe(1);

    const second = await runTriageForOwner(owner);
    expect(second.staged).toBe(0);
    expect(second.skipped).toBe(1);
    expect(h.proposals).toHaveLength(1);
  });
});
