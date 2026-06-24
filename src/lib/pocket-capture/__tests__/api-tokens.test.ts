import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_TOKEN_PREFIX,
  apiTokenPrefix,
  constantTimeEqualHex,
  generateApiToken,
  hashApiToken,
  isWellFormedApiToken,
  listApiTokens,
  mintTokenMaterial,
  revokeApiToken,
  verifyApiToken,
} from "../api-tokens";

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

describe("pure crypto helpers", () => {
  it("hashApiToken is a stable 64-char hex SHA-256", () => {
    const h = hashApiToken("pca_abc");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiToken("pca_abc")).toBe(h); // deterministic
    expect(hashApiToken("pca_abd")).not.toBe(h); // collision-resistant
  });

  it("apiTokenPrefix returns the first 8 chars (pca_ + 4)", () => {
    expect(apiTokenPrefix("pca_abcdefgh")).toBe("pca_abcd");
  });

  it("isWellFormedApiToken requires the pca_ scheme and a non-empty body", () => {
    expect(isWellFormedApiToken("pca_x")).toBe(true);
    expect(isWellFormedApiToken("pca_")).toBe(false);
    expect(isWellFormedApiToken("tok_x")).toBe(false);
    expect(isWellFormedApiToken("")).toBe(false);
  });
});

describe("mintTokenMaterial", () => {
  it("mints a pca_ token whose prefix + hash are self-consistent", () => {
    const m = mintTokenMaterial();
    expect(m.tokenPlaintext.startsWith(API_TOKEN_PREFIX)).toBe(true);
    expect(m.tokenPrefix).toBe(apiTokenPrefix(m.tokenPlaintext));
    expect(m.tokenHash).toBe(hashApiToken(m.tokenPlaintext));
    expect(m.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("mints a fresh, unguessable token each time", () => {
    const a = mintTokenMaterial();
    const b = mintTokenMaterial();
    expect(a.tokenPlaintext).not.toBe(b.tokenPlaintext);
    // 32 random bytes → base64url is ~43 chars on top of the 4-char scheme prefix.
    expect(a.tokenPlaintext.length).toBeGreaterThan(40);
  });
});

describe("constantTimeEqualHex (no timing leak / no throw)", () => {
  it("is true for equal digests", () => {
    const h = hashApiToken("x");
    expect(constantTimeEqualHex(h, h)).toBe(true);
  });

  it("is false for different same-length digests", () => {
    expect(constantTimeEqualHex(hashApiToken("a"), hashApiToken("b"))).toBe(false);
  });

  it("returns false (never throws) on a length mismatch", () => {
    // timingSafeEqual throws on unequal lengths — the wrapper must guard and return false.
    expect(() => constantTimeEqualHex("abc", "abcdef")).not.toThrow();
    expect(constantTimeEqualHex("abc", "abcdef")).toBe(false);
  });
});

describe("generateApiToken → verifyApiToken roundtrip", () => {
  it("mints a token, persists its hash, and verifies it back to the owner", async () => {
    // Capture what the INSERT stores, then have the verify lookup return that stored row.
    let stored: { token_hash: string; token_prefix: string; owner_id: string } | null = null;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        stored = JSON.parse(String(init.body)) as typeof stored;
        return jsonResponse(201, []);
      }
      // GET verify lookup → return the row we stored at mint, mimicking the DB.
      return jsonResponse(200, stored ? [{ id: "tok-1", owner_id: stored.owner_id, token_hash: stored.token_hash }] : []);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const mint = await generateApiToken("owner-1", "My iPhone");
    expect(mint.ok).toBe(true);
    if (!mint.ok) return;
    expect(mint.data.tokenPlaintext.startsWith("pca_")).toBe(true);
    expect(mint.data.tokenPrefix).toBe(apiTokenPrefix(mint.data.tokenPlaintext));
    // The stored row carries only the hash + prefix + name — never the plaintext.
    expect(stored).not.toBeNull();
    expect(stored!.token_hash).toBe(hashApiToken(mint.data.tokenPlaintext));
    expect(JSON.stringify(stored)).not.toContain(mint.data.tokenPlaintext);

    const verified = await verifyApiToken(mint.data.tokenPlaintext);
    expect(verified).toEqual({ ownerId: "owner-1" });
  });

  it("touches last_used_at on a successful verify", async () => {
    const hash = hashApiToken("pca_known");
    const calls: { url: string; method: string }[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET" });
      if ((init?.method ?? "GET") === "GET") {
        return jsonResponse(200, [{ id: "tok-9", owner_id: "owner-9", token_hash: hash }]);
      }
      return jsonResponse(200, []); // PATCH last_used_at (return=minimal)
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const verified = await verifyApiToken("pca_known");
    expect(verified).toEqual({ ownerId: "owner-9" });
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.url).toContain("id=eq.tok-9");
  });
});

describe("verifyApiToken — rejection paths", () => {
  it("rejects a malformed (non-pca_) token without any DB call", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, []));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    expect(await verifyApiToken("not-a-token")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown token (no matching row)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, [])));
    expect(await verifyApiToken("pca_unknown")).toBeNull();
  });

  it("scopes the lookup to non-revoked tokens, so a revoked token is rejected", async () => {
    // A revoked token's row is excluded by revoked_at=is.null, so the DB returns no row → null.
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toContain("revoked_at=is.null");
      return jsonResponse(200, []);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    expect(await verifyApiToken("pca_revoked")).toBeNull();
  });

  it("rejects when the stored hash fails the constant-time compare (defense-in-depth)", async () => {
    // Row comes back but with a mismatched hash — must not authenticate.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, [{ id: "t", owner_id: "o", token_hash: hashApiToken("pca_different") }]),
      ),
    );
    expect(await verifyApiToken("pca_actual")).toBeNull();
  });
});

describe("revokeApiToken", () => {
  it("soft-deletes the owner's token and reports it was revoked", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(init?.method).toBe("PATCH");
      const s = String(url);
      // Owner-scoped: both id AND owner_id pinned so a user can't revoke another's token.
      expect(s).toContain("id=eq.tok-1");
      expect(s).toContain("owner_id=eq.owner-1");
      expect(String(init?.body)).toContain("revoked_at");
      return jsonResponse(200, [{ id: "tok-1" }]);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const r = await revokeApiToken("tok-1", "owner-1");
    expect(r).toEqual({ ok: true, data: { revoked: true } });
  });

  it("reports revoked=false when no row matched (wrong owner or already revoked)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, [])));
    const r = await revokeApiToken("tok-x", "owner-2");
    expect(r).toEqual({ ok: true, data: { revoked: false } });
  });
});

describe("listApiTokens", () => {
  it("lists active tokens without exposing any secret", async () => {
    const rows = [
      { id: "t1", token_prefix: "pca_abcd", name: "iPhone", created_at: "2026-06-23T00:00:00Z", last_used_at: null, revoked_at: null },
    ];
    const fetchMock = vi.fn(async (url: string) => {
      const s = String(url);
      expect(s).toContain("owner_id=eq.owner-1");
      expect(s).toContain("revoked_at=is.null");
      // Never selects token_hash.
      expect(s).not.toContain("token_hash");
      return jsonResponse(200, rows);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const r = await listApiTokens("owner-1");
    expect(r).toEqual({ ok: true, data: rows });
  });
});
