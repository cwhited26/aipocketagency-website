import { describe, it, expect } from "vitest";
import { buildProviderPool, assignBackings, backingLabel, type ProviderTarget } from "../providers";
import type { LlmProviderSettingsRow } from "@/lib/llm/settings";
import type { RoundtableRole } from "../types";

const ROLES: RoundtableRole[] = ["steelman", "devils_advocate", "moderator"];
const identity = (s: string) => s;

function byoRow(over: Partial<LlmProviderSettingsRow>): LlmProviderSettingsRow {
  return {
    user_id: "u1",
    provider: "openai",
    encrypted_api_key: "enc-key",
    model_id: "gpt-4o",
    custom_endpoint_url: null,
    last_error_at: null,
    last_error_code: null,
    updated_at: "now",
    ...over,
  };
}

describe("buildProviderPool", () => {
  it("returns managed-only when there's no BYO row", () => {
    const pool = buildProviderPool(null, "pa-key", identity);
    expect(pool).toHaveLength(1);
    expect(pool[0].provider).toBe("pa_managed");
  });

  it("puts the BYO target first, then managed", () => {
    const pool = buildProviderPool(byoRow({}), "pa-key", identity);
    expect(pool.map((t) => t.provider)).toEqual(["openai", "pa_managed"]);
    expect(pool[0].apiKey).toBe("enc-key"); // identity decrypt
  });

  it("skips an undecryptable BYO key, degrading to managed", () => {
    const pool = buildProviderPool(byoRow({}), "pa-key", () => {
      throw new Error("bad envelope");
    });
    expect(pool.map((t) => t.provider)).toEqual(["pa_managed"]);
  });

  it("skips a custom provider with no endpoint", () => {
    const pool = buildProviderPool(
      byoRow({ provider: "custom_openai_compatible", custom_endpoint_url: null }),
      "pa-key",
      identity,
    );
    expect(pool.map((t) => t.provider)).toEqual(["pa_managed"]);
  });

  it("is empty when there's neither a BYO key nor a managed key", () => {
    expect(buildProviderPool(null, "", identity)).toHaveLength(0);
  });
});

describe("assignBackings", () => {
  it("returns null for an empty pool", () => {
    expect(assignBackings([], ROLES)).toBeNull();
  });

  it("gives every role the same target when the pool has one provider", () => {
    const pool = buildProviderPool(null, "pa-key", identity);
    const res = assignBackings(pool, ROLES)!;
    expect(backingLabel(res.backings.steelman)).toBe("pa_managed:claude-sonnet-4-6");
    expect(backingLabel(res.backings.devils_advocate)).toBe("pa_managed:claude-sonnet-4-6");
    expect(backingLabel(res.backings.moderator)).toBe("pa_managed:claude-sonnet-4-6");
  });

  it("backs the Steel-man and Devil's Advocate with different providers when the pool has two", () => {
    const pool = buildProviderPool(byoRow({}), "pa-key", identity);
    const res = assignBackings(pool, ROLES)!;
    expect(res.backings.steelman.provider).not.toBe(res.backings.devils_advocate.provider);
    // Moderator gets the most capable; pa_managed Claude breaks the premium tie.
    expect(res.backings.moderator.provider).toBe("pa_managed");
  });

  it("rotates a Domain Specialist back onto the first provider in a two-pool", () => {
    const pool = buildProviderPool(byoRow({}), "pa-key", identity);
    const roles: RoundtableRole[] = ["steelman", "devils_advocate", "domain_specialist", "moderator"];
    const res = assignBackings(pool, roles)!;
    expect(res.backings.domain_specialist.provider).toBe(res.backings.steelman.provider);
  });

  it("prefers a premium BYO model for the Moderator over a non-premium managed (synthetic pool)", () => {
    const premiumByo: ProviderTarget = { provider: "openai", model: "gpt-4o", apiKey: "k" };
    const weakManaged: ProviderTarget = { provider: "pa_managed", model: "some-old-model", apiKey: "k" };
    const res = assignBackings([premiumByo, weakManaged], ROLES)!;
    expect(res.backings.moderator).toBe(premiumByo);
  });
});
