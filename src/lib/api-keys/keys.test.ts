import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB layer so validateApiKey can be exercised without Supabase.
vi.mock("./db", () => ({
  fetchApiKeyByHash: vi.fn(),
  touchLastUsed: vi.fn(async () => undefined),
  insertApiKey: vi.fn(),
}));

import {
  generateApiKey,
  hashApiKey,
  extractBearerToken,
  looksLikePaKey,
  validateApiKey,
  KEY_SCHEME,
} from "./keys";
import { fetchApiKeyByHash, touchLastUsed, type ApiKeyRow } from "./db";

const mockFetch = vi.mocked(fetchApiKeyByHash);
const mockTouch = vi.mocked(touchLastUsed);

function row(overrides: Partial<ApiKeyRow> = {}): ApiKeyRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    user_id: "user-1",
    key_hash: "hash",
    key_prefix: "pa_live_abcd",
    name: "test",
    scopes: [],
    last_used_at: null,
    created_at: "2026-06-05T00:00:00Z",
    revoked_at: null,
    ...overrides,
  };
}

describe("api key generation + hashing", () => {
  it("generates a pa_live_ key with a hash and 12-char prefix", () => {
    const g = generateApiKey();
    expect(g.plaintext.startsWith(KEY_SCHEME)).toBe(true);
    expect(g.keyPrefix.length).toBe(12);
    expect(g.keyPrefix).toBe(g.plaintext.slice(0, 12));
    expect(g.keyHash).toBe(hashApiKey(g.plaintext));
    // The stored hash must not be the plaintext.
    expect(g.keyHash).not.toBe(g.plaintext);
  });

  it("hashes deterministically (SHA-256 hex, 64 chars)", () => {
    const h1 = hashApiKey("pa_live_abc");
    const h2 = hashApiKey("pa_live_abc");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("parses bearer tokens", () => {
    expect(extractBearerToken("Bearer pa_live_xyz")).toBe("pa_live_xyz");
    expect(extractBearerToken("bearer pa_live_xyz")).toBe("pa_live_xyz");
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken("Token abc")).toBeNull();
  });

  it("recognizes the key shape", () => {
    expect(looksLikePaKey("pa_live_abcdefghij")).toBe(true);
    expect(looksLikePaKey("pa_test_abc")).toBe(false);
    expect(looksLikePaKey("pa_live_x")).toBe(false);
  });
});

describe("validateApiKey", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockTouch.mockClear();
  });

  it("rejects a missing header", async () => {
    const r = await validateApiKey(null);
    expect(r).toEqual({ ok: false, reason: "missing" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects a malformed token before hitting the DB", async () => {
    const r = await validateApiKey("Bearer not-a-pa-key");
    expect(r).toEqual({ ok: false, reason: "malformed" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("looks up by the SHA-256 hash of the presented token", async () => {
    const g = generateApiKey();
    mockFetch.mockResolvedValue(row({ key_hash: g.keyHash }));
    const r = await validateApiKey(`Bearer ${g.plaintext}`);
    expect(mockFetch).toHaveBeenCalledWith(g.keyHash);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.key.key_hash).toBe(g.keyHash);
    // last_used_at touch is fire-and-forget.
    expect(mockTouch).toHaveBeenCalled();
  });

  it("rejects an unknown key", async () => {
    const g = generateApiKey();
    mockFetch.mockResolvedValue(null);
    const r = await validateApiKey(`Bearer ${g.plaintext}`);
    expect(r).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a revoked key", async () => {
    const g = generateApiKey();
    mockFetch.mockResolvedValue(row({ key_hash: g.keyHash, revoked_at: "2026-06-05T01:00:00Z" }));
    const r = await validateApiKey(`Bearer ${g.plaintext}`);
    expect(r).toEqual({ ok: false, reason: "revoked" });
  });
});
