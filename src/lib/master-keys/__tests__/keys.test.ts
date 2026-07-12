import { describe, it, expect } from "vitest";
import {
  sha256Hex,
  generateWorkspaceKey,
  extractBearerToken,
  WORKSPACE_KEY_SCHEME,
} from "../keys";

describe("master-keys/keys", () => {
  it("sha256Hex is deterministic 64-char hex and matches the seeded master key hash", () => {
    const hash = sha256Hex("pa_live_3Aw5Fd1eYE73_A95M0H9P5DQGk2d2iz-");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Guards the seed: this exact hash is what's stored in pa_master_keys for buildout-schedule.
    expect(hash).toBe("62d1e3cd6f7b7dd9d73ac7d59b0a4a96b9b44846cf45068a41a1c3133fdc7218");
  });

  it("generateWorkspaceKey returns pa_ws_ + 32 hex chars and a matching hash", () => {
    const { plaintext, keyHash } = generateWorkspaceKey();
    expect(plaintext.startsWith(WORKSPACE_KEY_SCHEME)).toBe(true);
    const random = plaintext.slice(WORKSPACE_KEY_SCHEME.length);
    expect(random).toMatch(/^[0-9a-f]{32}$/);
    expect(keyHash).toBe(sha256Hex(plaintext));
  });

  it("generateWorkspaceKey is unique per call", () => {
    expect(generateWorkspaceKey().plaintext).not.toBe(generateWorkspaceKey().plaintext);
  });

  it("extractBearerToken parses a valid header and rejects malformed ones", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
    expect(extractBearerToken("bearer  spaced  ")).toBe("spaced");
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken("Basic abc")).toBeNull();
    expect(extractBearerToken("Bearer ")).toBeNull();
  });
});
