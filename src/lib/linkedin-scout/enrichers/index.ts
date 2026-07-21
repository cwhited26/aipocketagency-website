// enrichers/index.ts — the enrichment adapter registry (SPEC §3, §12.3).
//
// One place the search dispatcher reads its adapters from, so adding a source is a one-line registry
// change. Each adapter self-reports whether it's configured; the dispatcher runs only the configured
// ones (optionally narrowed to the sources the owner picked in the search UI).

import type { EnrichmentSource } from "../types";
import type { Enricher } from "./types";
import { apolloEnricher } from "./apollo";
import { clayEnricher } from "./clay";
import { commonRoomEnricher } from "./common-room";
import { salesNavEnricher } from "./sales-nav";

export const ENRICHERS: readonly Enricher[] = [
  apolloEnricher,
  clayEnricher,
  commonRoomEnricher,
  salesNavEnricher,
];

/** The adapters the owner has configured (env key present today; per-owner connector row later). */
export function configuredEnrichers(): Enricher[] {
  return ENRICHERS.filter((e) => e.isConfigured());
}

/** Configured adapters narrowed to a requested source set (empty/undefined = all configured). */
export function enrichersFor(sources?: readonly EnrichmentSource[]): Enricher[] {
  const configured = configuredEnrichers();
  if (!sources || sources.length === 0) return configured;
  const wanted = new Set(sources);
  return configured.filter((e) => wanted.has(e.source));
}

export type { Enricher, EnricherResult } from "./types";
