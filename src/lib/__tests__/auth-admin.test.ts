import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveOrCreatePocketAgentUser, fetchAuthUserById } from "../auth-admin";

// Minimal Response stub — enough of the fetch Response surface for the helpers under test.
function res(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

describe("resolveOrCreatePocketAgentUser", () => {
  beforeEach(() => {
    process.env.POCKET_AGENT_SUPABASE_URL = "https://proj.supabase.co";
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY = "service-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.POCKET_AGENT_SUPABASE_URL;
    delete process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY;
  });

  it("creates a new user and reports wasCreated=true", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      expect(url).toContain("/auth/v1/admin/users");
      return res(200, { id: "user-new", email: "a@b.com" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await resolveOrCreatePocketAgentUser("a@b.com");
    expect(out).toEqual({ ok: true, user: { userId: "user-new", wasCreated: true } });
    // Confirmed + anonymous_signup metadata are set on create.
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.email_confirm).toBe(true);
    expect(body.user_metadata.anonymous_signup).toBe(true);
  });

  it("on 422 (email exists) probes the id via generate_link, wasCreated=false", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/auth/v1/admin/users")) return res(422, { msg: "email exists" });
      if (url.endsWith("/auth/v1/admin/generate_link")) {
        return res(200, { user: { id: "user-existing", email: "a@b.com" } });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await resolveOrCreatePocketAgentUser("a@b.com");
    expect(out).toEqual({ ok: true, user: { userId: "user-existing", wasCreated: false } });
  });

  it("surfaces a non-conflict create error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(500, "boom")));
    const out = await resolveOrCreatePocketAgentUser("a@b.com");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(500);
  });

  it("errors cleanly when service-role env is missing", async () => {
    delete process.env.POCKET_AGENT_SUPABASE_URL;
    delete process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.WC_ADMIN_SUPABASE_URL;
    delete process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
    const out = await resolveOrCreatePocketAgentUser("a@b.com");
    expect(out.ok).toBe(false);
  });
});

describe("fetchAuthUserById", () => {
  beforeEach(() => {
    process.env.POCKET_AGENT_SUPABASE_URL = "https://proj.supabase.co";
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY = "service-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.POCKET_AGENT_SUPABASE_URL;
    delete process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY;
  });

  it("returns the user with last_sign_in_at", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res(200, { id: "u1", email: "a@b.com", last_sign_in_at: "2026-07-01T00:00:00Z" })),
    );
    const out = await fetchAuthUserById("u1");
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.user?.last_sign_in_at).toBe("2026-07-01T00:00:00Z");
  });

  it("returns user:null on 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(404, "not found")));
    const out = await fetchAuthUserById("missing");
    expect(out).toEqual({ ok: true, user: null });
  });
});
