import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock every I/O dependency so the sweep's cadence logic is tested in isolation.
vi.mock("../pocket-agent-supabase", () => ({
  listRecentPocketAgentTrials: vi.fn(),
  patchPocketAgentSequenceState: vi.fn(async () => ({ ok: true })),
}));
vi.mock("../auth-admin", () => ({ fetchAuthUserById: vi.fn() }));
vi.mock("../pocket-agent-login-link", () => ({ sendPocketAgentLoginLink: vi.fn(async () => ({ ok: true })) }));
vi.mock("../resend", () => ({ sendEmail: vi.fn(async () => ({ ok: true, id: "e1" })) }));

import { sweepOrphanedSignups } from "../orphaned-signups";
import {
  listRecentPocketAgentTrials,
  patchPocketAgentSequenceState,
  type RecentTrialRow,
} from "../pocket-agent-supabase";
import { fetchAuthUserById } from "../auth-admin";
import { sendPocketAgentLoginLink } from "../pocket-agent-login-link";

const NOW = new Date("2026-07-02T12:00:00Z");
const HOUR = 60 * 60 * 1000;

function trial(overrides: Partial<RecentTrialRow>): RecentTrialRow {
  return {
    stripe_subscription_id: "sub_1",
    user_id: "user_1",
    email: "buyer@example.com",
    name: "Dana",
    status: "trial",
    created_at: new Date(NOW.getTime() - 30 * HOUR).toISOString(),
    email_sequence_state: {},
    ...overrides,
  };
}

const mocked = {
  list: vi.mocked(listRecentPocketAgentTrials),
  patch: vi.mocked(patchPocketAgentSequenceState),
  authUser: vi.mocked(fetchAuthUserById),
  loginLink: vi.mocked(sendPocketAgentLoginLink),
};

describe("sweepOrphanedSignups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.patch.mockResolvedValue({ ok: true });
    mocked.loginLink.mockResolvedValue({ ok: true });
  });

  it("nudges a 30h-old never-logged-in buyer and stamps orphan_24h_sent", async () => {
    mocked.list.mockResolvedValue({ ok: true, rows: [trial({})] });
    mocked.authUser.mockResolvedValue({ ok: true, user: { id: "user_1", last_sign_in_at: null } });

    const out = await sweepOrphanedSignups(NOW);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.nudged).toBe(1);
    expect(mocked.loginLink).toHaveBeenCalledWith("buyer@example.com");
    const [, nextState] = mocked.patch.mock.calls[0];
    expect(nextState).toMatchObject({ orphan_24h_sent: true });
    expect(nextState).not.toHaveProperty("orphan_72h_sent");
  });

  it("skips a buyer younger than 24h", async () => {
    mocked.list.mockResolvedValue({
      ok: true,
      rows: [trial({ created_at: new Date(NOW.getTime() - 10 * HOUR).toISOString() })],
    });

    const out = await sweepOrphanedSignups(NOW);
    if (out.ok) {
      expect(out.data.nudged).toBe(0);
      expect(out.data.skipped).toBe(1);
    }
    expect(mocked.authUser).not.toHaveBeenCalled();
  });

  it("skips (and stamps done) a buyer who already logged in", async () => {
    mocked.list.mockResolvedValue({ ok: true, rows: [trial({})] });
    mocked.authUser.mockResolvedValue({
      ok: true,
      user: { id: "user_1", last_sign_in_at: "2026-07-02T00:00:00Z" },
    });

    const out = await sweepOrphanedSignups(NOW);
    if (out.ok) expect(out.data.nudged).toBe(0);
    expect(mocked.loginLink).not.toHaveBeenCalled();
    const [, nextState] = mocked.patch.mock.calls[0];
    expect(nextState).toMatchObject({ orphan_24h_sent: true, orphan_72h_sent: true });
  });

  it("at 80h with the 24h stamp already set, fires the 72h nudge", async () => {
    mocked.list.mockResolvedValue({
      ok: true,
      rows: [
        trial({
          created_at: new Date(NOW.getTime() - 80 * HOUR).toISOString(),
          email_sequence_state: { orphan_24h_sent: true },
        }),
      ],
    });
    mocked.authUser.mockResolvedValue({ ok: true, user: { id: "user_1", last_sign_in_at: null } });

    const out = await sweepOrphanedSignups(NOW);
    if (out.ok) expect(out.data.nudged).toBe(1);
    const [, nextState] = mocked.patch.mock.calls[0];
    expect(nextState).toMatchObject({ orphan_24h_sent: true, orphan_72h_sent: true });
  });

  it("propagates a list failure", async () => {
    mocked.list.mockResolvedValue({ ok: false, status: 500, error: "db down" });
    const out = await sweepOrphanedSignups(NOW);
    expect(out.ok).toBe(false);
  });
});
