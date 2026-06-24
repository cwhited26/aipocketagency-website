import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decideOnboardingRoute,
  readOnboardingCompletedAt,
  markOnboardingCompleted,
} from "../onboarding";

beforeEach(() => {
  process.env.POCKET_AGENT_SUPABASE_URL = "https://test.supabase.co";
  process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY = "test-service-key";
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("decideOnboardingRoute (route guards)", () => {
  it("sends a logged-out visitor to login", () => {
    expect(
      decideOnboardingRoute({ hasUser: false, isPocketCaptureUser: false, completedAt: null }),
    ).toBe("login");
  });

  it("sends a signed-in non-Pocket-Capture user to PA Launch Kit", () => {
    expect(
      decideOnboardingRoute({ hasUser: true, isPocketCaptureUser: false, completedAt: null }),
    ).toBe("launch-kit");
  });

  it("sends an already-onboarded buyer to the dashboard", () => {
    expect(
      decideOnboardingRoute({
        hasUser: true,
        isPocketCaptureUser: true,
        completedAt: "2026-06-23T00:00:00.000Z",
      }),
    ).toBe("completed");
  });

  it("shows the wizard to a buyer who hasn't onboarded", () => {
    expect(
      decideOnboardingRoute({ hasUser: true, isPocketCaptureUser: true, completedAt: null }),
    ).toBe("show");
  });
});

describe("readOnboardingCompletedAt", () => {
  it("returns the timestamp when set", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, [{ pocket_capture_onboarding_completed_at: "2026-06-23T10:00:00.000Z" }]),
    );
    const res = await readOnboardingCompletedAt("u1");
    expect(res).toEqual({ ok: true, data: "2026-06-23T10:00:00.000Z" });
  });

  it("returns null when not yet onboarded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, [{ pocket_capture_onboarding_completed_at: null }]),
    );
    const res = await readOnboardingCompletedAt("u1");
    expect(res).toEqual({ ok: true, data: null });
  });

  it("404s when the user row is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, []));
    const res = await readOnboardingCompletedAt("u1");
    expect(res.ok).toBe(false);
  });
});

describe("markOnboardingCompleted (idempotent)", () => {
  it("stamps the timestamp on first completion", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse(200, [{ pocket_capture_onboarding_completed_at: "2026-06-23T12:00:00.000Z" }]),
      );
    const res = await markOnboardingCompleted("u1", "2026-06-23T12:00:00.000Z");
    expect(res).toEqual({ ok: true, data: { completedAt: "2026-06-23T12:00:00.000Z" } });

    const call = fetchSpy.mock.calls[0];
    expect(call[1]?.method).toBe("PATCH");
    // Filtered to NULL so a re-run never moves the original completion time.
    expect(call[0] as string).toContain("pocket_capture_onboarding_completed_at=is.null");
  });

  it("re-reads and returns the original time when already completed (filtered PATCH matched nothing)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    // PATCH matches no rows (already set) → empty representation array.
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, []));
    // Re-read returns the durable original timestamp.
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, [{ pocket_capture_onboarding_completed_at: "2026-06-20T08:00:00.000Z" }]),
    );
    const res = await markOnboardingCompleted("u1", "2026-06-23T12:00:00.000Z");
    expect(res).toEqual({ ok: true, data: { completedAt: "2026-06-20T08:00:00.000Z" } });
  });

  it("404s when neither the PATCH nor the re-read finds a row", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, []));
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, []));
    const res = await markOnboardingCompleted("u1", "2026-06-23T12:00:00.000Z");
    expect(res.ok).toBe(false);
  });
});
