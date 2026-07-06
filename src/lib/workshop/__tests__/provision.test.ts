// The workshop webhook provisioning path (PA-POS-38 §24.4) with injected deps — no network.

import { describe, expect, it, vi } from "vitest";
import {
  formatSlotDisplay,
  handleWorkshopCheckoutCompleted,
  type ProvisionDeps,
  workshopLobbyUrl,
} from "../provision";
import type { WorkshopRegistrationRow } from "../db";

const REG_ID = "11111111-2222-3333-4444-555555555555";
const SLOT_ISO = "2026-07-08T18:00:00.000Z";

function registration(overrides: Partial<WorkshopRegistrationRow> = {}): WorkshopRegistrationRow {
  return {
    id: REG_ID,
    owner_id: null,
    email: "buyer@example.com",
    name: "Dana",
    stripe_customer_id: null,
    stripe_session_id: null,
    chosen_slot_at: SLOT_ISO,
    timezone: "America/Chicago",
    bump_selected: true,
    session_status: "registered",
    created_at: "2026-07-05T12:00:00.000Z",
    ...overrides,
  };
}

function makeDeps(row: WorkshopRegistrationRow): ProvisionDeps & {
  patched: Array<Record<string, unknown>>;
  bumps: unknown[];
  enqueued: unknown[];
} {
  const patched: Array<Record<string, unknown>> = [];
  const bumps: unknown[] = [];
  const enqueued: unknown[] = [];
  return {
    patched,
    bumps,
    enqueued,
    getRegistration: vi.fn(async () => ({ ok: true as const, data: row })),
    patchRegistration: vi.fn(async (_id: string, patch: Record<string, unknown>) => {
      patched.push(patch);
      return { ok: true as const, data: undefined };
    }),
    insertBump: vi.fn(async (args: unknown) => {
      bumps.push(args);
      return { ok: true as const, data: undefined };
    }),
    stampTrialSource: vi.fn(async () => ({ ok: true as const, data: undefined })),
    resolveOrCreateUser: vi.fn(async () => ({
      ok: true as const,
      user: { userId: "owner-uuid", wasCreated: true },
    })),
    enqueueEmails: vi.fn(async (who: unknown, slotAtMs: number, props: unknown) => {
      enqueued.push({ who, slotAtMs, props });
      return { ok: true as const, count: 4 };
    }),
    log: vi.fn(),
  } as unknown as ProvisionDeps & {
    patched: Array<Record<string, unknown>>;
    bumps: unknown[];
    enqueued: unknown[];
  };
}

const SESSION = {
  id: "cs_test_123",
  customer: "cus_123",
  metadata: {
    source: "pa_workshop",
    registration_id: REG_ID,
    bump_fast_start_brain_import: "true",
  },
};

describe("handleWorkshopCheckoutCompleted", () => {
  it("provisions: resolves the account, stamps the registration, ledgers the bump, enqueues 4 emails", async () => {
    const deps = makeDeps(registration());
    const outcome = await handleWorkshopCheckoutCompleted(SESSION, deps);
    expect(outcome).toEqual({
      ok: true,
      registrationId: REG_ID,
      ownerId: "owner-uuid",
      emailsEnqueued: 4,
    });
    expect(deps.patched[0]).toMatchObject({
      owner_id: "owner-uuid",
      stripe_customer_id: "cus_123",
      stripe_session_id: "cs_test_123",
    });
    expect(deps.bumps).toHaveLength(1);
    const enq = deps.enqueued[0] as { slotAtMs: number; props: { lobbyUrl: string; bump: boolean } };
    expect(enq.slotAtMs).toBe(Date.parse(SLOT_ISO));
    expect(enq.props.lobbyUrl).toBe(workshopLobbyUrl(REG_ID));
    expect(enq.props.bump).toBe(true);
  });

  it("is idempotent: a Stripe retry with the already-stamped session is a no-op", async () => {
    const deps = makeDeps(registration({ stripe_session_id: "cs_test_123", owner_id: "owner-uuid" }));
    const outcome = await handleWorkshopCheckoutCompleted(SESSION, deps);
    expect(outcome).toEqual({ ok: true, registrationId: REG_ID, ownerId: "owner-uuid", emailsEnqueued: 0 });
    expect(deps.patched).toHaveLength(0);
    expect(deps.enqueued).toHaveLength(0);
  });

  it("skips the bump ledger when the checkbox wasn't ticked", async () => {
    const deps = makeDeps(registration());
    await handleWorkshopCheckoutCompleted(
      { ...SESSION, metadata: { source: "pa_workshop", registration_id: REG_ID } },
      deps,
    );
    expect(deps.bumps).toHaveLength(0);
  });

  it("fails loudly (so Stripe retries) when metadata is missing", async () => {
    const deps = makeDeps(registration());
    const outcome = await handleWorkshopCheckoutCompleted({ id: "cs_x", customer: null, metadata: {} }, deps);
    expect(outcome.ok).toBe(false);
  });
});

describe("formatSlotDisplay", () => {
  it("renders the slot in the attendee's timezone", () => {
    const display = formatSlotDisplay(SLOT_ISO, "America/Chicago");
    expect(display).toContain("July 8");
    expect(display).toContain("1:00");
  });
});
