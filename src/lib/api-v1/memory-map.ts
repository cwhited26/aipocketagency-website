// memory-map.ts — translates between the Public API's memory-tier names and the
// internal MemoryTier vocabulary. The API exposes work/knowledge/patterns; on disk the
// "patterns" tier is the `learning` folder (memory-tier.ts).

import { MEMORY_TIER_FOLDER, type MemoryTier } from "@/lib/brain/memory-tier";
import type { ApiMemoryTier } from "./schemas";

export function apiTierToInternal(tier: ApiMemoryTier): MemoryTier {
  return tier === "patterns" ? "learning" : tier;
}

export function internalTierToApi(tier: MemoryTier): ApiMemoryTier {
  return tier === "learning" ? "patterns" : tier;
}

export function folderForApiTier(tier: ApiMemoryTier): string {
  return MEMORY_TIER_FOLDER[apiTierToInternal(tier)];
}
