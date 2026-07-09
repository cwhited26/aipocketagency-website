// OAuth lifecycle — code exchange, refresh-grant params, response-shape rejection, and the
// ensureFreshAgencyToken decision (cached token vs refresh-and-persist vs needs_reauth).
// Network is stubbed; the store layer is mocked so no DB is touched.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

vi.mock("../store", () => ({
  updateGhlTokens: vi.fn(
    async (
      _connectionId: string,
      _tokens: { accessTokenEncrypted: string; refreshTokenEncrypted: string; tokenExpiresAt: string },
    ) => ({ ok: true, data: undefined }),
  ),
  markGhlConnectionNeedsReauth: vi.fn(async (_connectionId: string) => ({
    ok: true,
    data: undefined,
  })),
}));

import {
  buildGhlAuthorizeUrl,
  ensureFreshAgencyToken,
  exchangeCodeForTokens,
  refreshAgencyTokens,
} from "../oauth";
import { encryptGhlToken } from "../crypto";
import { markGhlConnectionNeedsReauth, updateGhlTokens } from "../store";
import type { GhlConnectionFull } from "../store";

const KEY = crypto.randomBytes(32).toString("base64");

const TOKEN_RESPONSE = {
  access_token: "at_new",
  refresh_token: "rt_new",
  expires_in: 86_399,
  scope: "locations.readonly contacts.write",
  token_type: "Bearer",
  userType: "Company",
  companyId: "comp_1",
};

function fetchMock(status: number, body: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

function connection(overrides: Partial<GhlConnectionFull>): GhlConnectionFull {
  return {
    id: "conn_1",
    owner_id: "owner_1",
    agency_company_id: "comp_1",
    agency_location_id: null,
    user_type: "Company",
    scopes: [],
    status: "active",
    token_expires_at: null,
    created_at: "2026-07-08T00:00:00Z",
    updated_at: "2026-07-08T00:00:00Z",
    access_token_encrypted: null,
    refresh_token_encrypted: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("GHL_TOKEN_ENCRYPTION_KEY", KEY);
  vi.stubEnv("GHL_CLIENT_ID", "client_1");
  vi.stubEnv("GHL_CLIENT_SECRET", "secret_1");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("buildGhlAuthorizeUrl", () => {
  it("points at the Marketplace chooselocation URL with the scope set + state", () => {
    const url = new URL(buildGhlAuthorizeUrl("client_1", "signed-state"));
    expect(url.origin + url.pathname).toBe(
      "https://marketplace.gohighlevel.com/oauth/chooselocation",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client_1");
    expect(url.searchParams.get("state")).toBe("signed-state");
    expect(url.searchParams.get("scope")).toContain("locations.readonly");
    expect(url.searchParams.get("scope")).toContain("contacts.write");
  });
});

describe("exchangeCodeForTokens / refreshAgencyTokens", () => {
  it("exchanges a code with grant_type=authorization_code + user_type=Company", async () => {
    const mock = fetchMock(200, TOKEN_RESPONSE);
    vi.stubGlobal("fetch", mock);
    const res = await exchangeCodeForTokens("code_123");
    expect(res.ok).toBe(true);
    const call = (mock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(call[0])).toBe("https://services.leadconnectorhq.com/oauth/token");
    const params = new URLSearchParams(String(call[1].body));
    expect(params.get("grant_type")).toBe("authorization_code");
    expect(params.get("code")).toBe("code_123");
    expect(params.get("user_type")).toBe("Company");
  });

  it("refreshes with grant_type=refresh_token", async () => {
    const mock = fetchMock(200, TOKEN_RESPONSE);
    vi.stubGlobal("fetch", mock);
    const res = await refreshAgencyTokens("rt_old", "Company");
    expect(res.ok).toBe(true);
    const params = new URLSearchParams(
      String((mock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body),
    );
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("rt_old");
  });

  it("rejects a token response with a shape Zod refuses", async () => {
    vi.stubGlobal("fetch", fetchMock(200, { access_token: "at", expires_in: 100 }));
    const res = await exchangeCodeForTokens("code_123");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(502);
  });

  it("flags invalid_grant as an auth failure", async () => {
    vi.stubGlobal("fetch", fetchMock(400, '{"error":"invalid_grant"}'));
    const res = await refreshAgencyTokens("rt_dead", "Company");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.authError).toBe(true);
  });
});

describe("ensureFreshAgencyToken", () => {
  it("returns the cached access token without any network when it is fresh", async () => {
    const mock = fetchMock(500, "should not be called");
    vi.stubGlobal("fetch", mock);
    const conn = connection({
      access_token_encrypted: encryptGhlToken("at_cached"),
      token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const res = await ensureFreshAgencyToken(conn);
    expect(res).toEqual({ ok: true, data: "at_cached" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("refreshes an expired token and persists the ROTATED pair (single-use refresh tokens)", async () => {
    vi.stubGlobal("fetch", fetchMock(200, TOKEN_RESPONSE));
    const conn = connection({
      access_token_encrypted: encryptGhlToken("at_stale"),
      refresh_token_encrypted: encryptGhlToken("rt_old"),
      token_expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    const res = await ensureFreshAgencyToken(conn);
    expect(res).toEqual({ ok: true, data: "at_new" });
    expect(updateGhlTokens).toHaveBeenCalledTimes(1);
    const persisted = vi.mocked(updateGhlTokens).mock.calls[0][1];
    expect(persisted.accessTokenEncrypted).not.toContain("at_new"); // ciphertext, not plaintext
    expect(persisted.refreshTokenEncrypted).not.toContain("rt_new");
  });

  it("flips the connection to needs_reauth when the refresh grant is dead", async () => {
    vi.stubGlobal("fetch", fetchMock(400, '{"error":"invalid_grant"}'));
    const conn = connection({
      refresh_token_encrypted: encryptGhlToken("rt_dead"),
      token_expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    const res = await ensureFreshAgencyToken(conn);
    expect(res.ok).toBe(false);
    expect(markGhlConnectionNeedsReauth).toHaveBeenCalledWith("conn_1");
  });

  it("errors without a refresh token instead of guessing", async () => {
    const res = await ensureFreshAgencyToken(connection({}));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.authError).toBe(true);
  });
});
