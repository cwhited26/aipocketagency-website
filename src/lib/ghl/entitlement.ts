// entitlement.ts — the one gate every GHL surface + the executor asks (PA-GHL-6): does this
// owner get the connector, and how many client sub-accounts can they run? Tier wins over pass
// (the PA-POS-31 rule); an active $50 / 7-day GHL Project Pass rents exactly ONE client to the
// tiers below Pro+.

import { hasAppEntitlement } from "@/lib/metering/entitlement";
import { ghlClientCap, type Tier } from "@/lib/personas/tier-caps";
import type { EntitlementSource } from "@/lib/metering/passes";

/** The client cap an active GHL Project Pass rents (PA-GHL-6: 1-client proof-of-concept). */
export const GHL_PASS_CLIENT_CAP = 1;

export type GhlAccess = {
  allowed: boolean;
  /** null = uncapped (Enterprise). 0 only when not allowed. */
  clientCap: number | null;
  source: EntitlementSource | null;
  tier: Tier;
};

/** Pure cap resolution — unit-tested without I/O. */
export function resolveGhlClientCap(
  tier: Tier,
  source: EntitlementSource | null,
): number | null {
  if (source === "tier") return ghlClientCap(tier);
  if (source === "project_pass") return GHL_PASS_CLIENT_CAP;
  return 0;
}

/** Tier + Project Pass in one read. Every GHL route and the write executor call this. */
export async function resolveGhlAccess(
  ownerId: string,
  opts?: { tier?: Tier; now?: Date },
): Promise<GhlAccess> {
  const access = await hasAppEntitlement(ownerId, "ghl_connector", opts);
  return {
    allowed: access.allowed,
    clientCap: access.allowed ? resolveGhlClientCap(access.tier, access.source) : 0,
    source: access.source,
    tier: access.tier,
  };
}
