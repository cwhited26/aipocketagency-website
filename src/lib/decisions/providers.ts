// providers.ts — model-diversity resolution (PA-DR-3). The saved-settings dispatcher (lib/llm/dispatch)
// only ever resolves ONE primary provider per user, so it can't back a single roundtable's agents with
// different model families. This builds a pool of the owner's available distinct targets (PA-managed
// Claude + their one BYO provider, today) and assigns each role a backing that maximizes disagreement:
// the Steel-man and Devil's Advocate get the two most distinct providers when the pool has two, the
// Moderator gets the most capable, and the optional Domain Specialist rotates. When the pool collapses
// to one provider, the role prompts in roles.ts carry the disagreement instead.

import { isPremiumTierModel, PA_MANAGED_MODEL, type LlmProvider } from "@/lib/llm/types";
import { loadProviderSettings, type LlmProviderSettingsRow } from "@/lib/llm/settings";
import { decryptProviderKey } from "@/lib/crypto/provider-key";
import type { RoundtableRole } from "./types";

export type ProviderTarget = {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  endpointUrl?: string;
};

/** provider:model display string stamped into model_backings + each turn row. */
export function backingLabel(t: ProviderTarget): string {
  return `${t.provider}:${t.model}`;
}

// Higher = more capable / more house-aligned. Premium-tier model dominates; pa_managed Claude breaks
// ties so the Moderator lands on the calibrated house model when nothing premium beats it.
function targetRank(t: ProviderTarget): number {
  return (isPremiumTierModel(t.model) ? 2 : 0) + (t.provider === "pa_managed" ? 1 : 0);
}

/**
 * Builds the pool of distinct available targets from the owner's saved provider row + the PA-managed
 * key. Pure given its inputs (the decrypt fn is injectable) so the diversity logic is unit-tested
 * without a DB or real keys. Order: BYO first (the more-distinct family from house Claude), then
 * managed — so a two-provider pool puts the owner's own model at index 0.
 */
export function buildProviderPool(
  settings: LlmProviderSettingsRow | null,
  paManagedKey: string,
  decrypt: (envelope: string) => string,
): ProviderTarget[] {
  const pool: ProviderTarget[] = [];

  // BYO target, when the row is usable (has a model + a decryptable key, and an endpoint for custom).
  if (settings && settings.provider !== "pa_managed" && settings.model_id && settings.encrypted_api_key) {
    let apiKey: string | null = null;
    try {
      apiKey = decrypt(settings.encrypted_api_key);
    } catch {
      apiKey = null; // undecryptable → skip BYO, fall through to managed only
    }
    const endpointOk = settings.provider !== "custom_openai_compatible" || Boolean(settings.custom_endpoint_url);
    if (apiKey && endpointOk) {
      pool.push({
        provider: settings.provider,
        model: settings.model_id,
        apiKey,
        endpointUrl: settings.custom_endpoint_url ?? undefined,
      });
    }
  }

  if (paManagedKey) {
    pool.push({ provider: "pa_managed", model: PA_MANAGED_MODEL, apiKey: paManagedKey });
  }

  return pool;
}

/**
 * Assigns each role a backing from the pool. Pure. The Moderator gets the most capable target; the
 * arguing roles round-robin so the Steel-man and Devil's Advocate land on different providers whenever
 * the pool has more than one. Returns null when the pool is empty (no usable key at all).
 */
export function assignBackings(
  pool: ProviderTarget[],
  roles: RoundtableRole[],
): { backings: Record<string, ProviderTarget>; fallback: ProviderTarget } | null {
  if (pool.length === 0) return null;

  // Moderator → most capable (premium first, pa_managed tiebreak). Also the universal fallback target.
  const best = pool.reduce((a, b) => (targetRank(b) > targetRank(a) ? b : a), pool[0]);

  const arguing = roles.filter((r) => r !== "moderator" && r !== "owner_interjection");
  const backings: Record<string, ProviderTarget> = {};
  arguing.forEach((role, i) => {
    backings[role] = pool[i % pool.length];
  });
  if (roles.includes("moderator")) backings.moderator = best;

  return { backings, fallback: best };
}

/**
 * Loads the owner's saved provider settings and resolves a backing per role. The async seam over the
 * two pure helpers above. `paManagedKey` is the owner's Anthropic key (PA's managed key stand-in).
 */
export async function resolveBackings(
  userId: string,
  paManagedKey: string,
  roles: RoundtableRole[],
): Promise<{ backings: Record<string, ProviderTarget>; fallback: ProviderTarget } | null> {
  let settings: LlmProviderSettingsRow | null = null;
  try {
    settings = await loadProviderSettings(userId);
  } catch {
    settings = null; // settings read failure → PA-managed only, never block the run
  }
  const pool = buildProviderPool(settings, paManagedKey, decryptProviderKey);
  return assignBackings(pool, roles);
}
