// hasAppEntitlement (PA-POS-31) — THE App gate. Every surface that used to ask "is the tier high
// enough?" for a rentable App now asks this instead: tier OR active Project Pass for the slug.
// Pure decision logic lives in ./passes (unit-tested); this file is the thin I/O wrapper.

import type { PassAppSlug } from "@/data/project-passes";
import { getCurrentTier, type Tier } from "@/lib/personas/tier-caps";
import {
  activePassForApp,
  resolveAppEntitlement,
  shouldShowConversionNudge,
  type AppEntitlement,
  type ProjectPass,
} from "./passes";
import { listPassesForOwner } from "./store";

export type OwnerAppAccess = AppEntitlement & {
  tier: Tier;
  /** Every pass the owner holds (any App) — pages reuse this for the nudge without a second read. */
  passes: ProjectPass[];
  /** The PA-POS-31 amendment card: 2+ passes for this App inside 21 days. Education, never a gate. */
  showConversionNudge: boolean;
};

/**
 * Resolve tier + passes for one App in one call. Pass `opts.tier` when the caller already
 * resolved it (every App page does) to skip the duplicate subscription read.
 */
export async function hasAppEntitlement(
  ownerId: string,
  appSlug: PassAppSlug,
  opts?: { tier?: Tier; now?: Date },
): Promise<OwnerAppAccess> {
  const now = opts?.now ?? new Date();
  const [tier, passes] = await Promise.all([
    opts?.tier ? Promise.resolve(opts.tier) : getCurrentTier(ownerId),
    listPassesForOwner(ownerId),
  ]);
  const entitlement = resolveAppEntitlement(tier, appSlug, passes, now);
  return {
    ...entitlement,
    tier,
    passes,
    showConversionNudge: shouldShowConversionNudge(passes, appSlug, now),
  };
}

/** The active pass for an App from an already-fetched pass list (no extra read). */
export function activePass(
  passes: readonly ProjectPass[],
  appSlug: PassAppSlug,
  now: Date = new Date(),
): ProjectPass | null {
  return activePassForApp(passes, appSlug, now);
}
