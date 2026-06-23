import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateCaptureSlug,
  captureEmailForSlug,
  captureSlugFromAddress,
  lookupOwnerByCaptureSlug,
  ensureCaptureEmailSlug,
} from "../slug";

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

describe("generateCaptureSlug", () => {
  it("produces a 12-char lowercase-alphanumeric slug", () => {
    const slug = generateCaptureSlug();
    expect(slug).toHaveLength(12);
    expect(slug).toMatch(/^[a-z0-9]{12}$/);
  });
  it("produces distinct slugs across calls", () => {
    expect(generateCaptureSlug()).not.toBe(generateCaptureSlug());
  });
});

describe("captureEmailForSlug", () => {
  it("builds the address on the capture domain", () => {
    expect(captureEmailForSlug("abc123def456")).toBe("abc123def456@capture.aipocketagent.com");
  });
});

describe("captureSlugFromAddress", () => {
  it("extracts the slug from a capture-domain address", () => {
    expect(captureSlugFromAddress("abc123@capture.aipocketagent.com")).toBe("abc123");
  });
  it("strips a +tag suffix", () => {
    expect(captureSlugFromAddress("abc123+work@capture.aipocketagent.com")).toBe("abc123");
  });
  it("is case-insensitive on the domain", () => {
    expect(captureSlugFromAddress("ABC@Capture.AiPocketAgent.com")).toBe("abc");
  });
  it("returns null for a non-capture domain", () => {
    expect(captureSlugFromAddress("abc@other.com")).toBeNull();
  });
  it("returns null when there is no @", () => {
    expect(captureSlugFromAddress("not-an-address")).toBeNull();
  });
});

describe("lookupOwnerByCaptureSlug", () => {
  it("resolves a slug to its owner row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(200, [{ id: "owner-1", brain_repo: "me/brain", github_token: "ght" }])),
    );
    const r = await lookupOwnerByCaptureSlug("abc123");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ id: "owner-1", brain_repo: "me/brain", github_token: "ght" });
  });

  it("returns null when no user owns the slug", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, [])));
    const r = await lookupOwnerByCaptureSlug("nobody");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toBeNull();
  });
});

describe("ensureCaptureEmailSlug", () => {
  it("returns the existing slug without provisioning a new one", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, [{ pocket_capture_email_slug: "existingslug1" }]));
    vi.stubGlobal("fetch", fetchMock);
    const r = await ensureCaptureEmailSlug("owner-1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.email).toBe("existingslug1@capture.aipocketagent.com");
    expect(fetchMock).toHaveBeenCalledTimes(1); // read only, no PATCH
  });

  it("provisions a slug when the user has none yet", async () => {
    const fetchMock = vi
      .fn()
      // 1) read current slug → null
      .mockResolvedValueOnce(jsonResponse(200, [{ pocket_capture_email_slug: null }]))
      // 2) PATCH claim → one row updated
      .mockResolvedValueOnce(jsonResponse(200, [{ id: "owner-1" }]));
    vi.stubGlobal("fetch", fetchMock);
    const r = await ensureCaptureEmailSlug("owner-1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.email).toMatch(/^[a-z0-9]{12}@capture\.aipocketagent\.com$/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on a cross-user slug collision then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, [{ pocket_capture_email_slug: null }])) // read → null
      .mockResolvedValueOnce(jsonResponse(409, { message: "duplicate key value (23505)" })) // claim → taken
      .mockResolvedValueOnce(jsonResponse(200, [{ id: "owner-1" }])); // retry claim → ok
    vi.stubGlobal("fetch", fetchMock);
    const r = await ensureCaptureEmailSlug("owner-1");
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
