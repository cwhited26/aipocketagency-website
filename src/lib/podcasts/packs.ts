// packs.ts — Podcast Ingester Phase 4 (vertical curation packs, PA-PC-14).
//
// A pack is a hand-curated bundle of 5-8 shows for a vertical that the owner follows in one tap:
// "subscribe-all" creates a pa_podcast_watch row per show, stamped with the pack slug. The pack configs
// are static JSON in the repo (src/data/podcast-packs/<vertical>.json), not rows — the same pattern as
// the Lead Scout vertical packs. This loader reads the JSON, types it, and exposes the show list the
// subscribe route fans into watches. Three launch verticals: contractor, med-spa, sales.

import type { WatchCadence } from "./watch";

import contractor from "@/data/podcast-packs/contractor.json";
import medSpa from "@/data/podcast-packs/med-spa.json";
import sales from "@/data/podcast-packs/sales.json";

/** One show inside a pack — pre-resolved to a real feed (iTunes id + RSS feed URL). */
export type PackShow = {
  show_id: string;
  title: string;
  host: string;
  feed_url: string;
  apple_url: string;
  why: string;
};

/** A vertical pack as it lives on disk + in memory. */
export type PodcastPack = {
  name: string;
  vertical_slug: string;
  /** Emoji shown on the pack card. */
  icon: string;
  tagline: string;
  display_description: string;
  /** The cadence each show is followed at when the owner subscribes to the pack. */
  default_cadence: WatchCadence;
  /** Whether the pack defaults to notes-only mode (cost-light) when subscribed. */
  notes_only_default: boolean;
  recommended_tier: "studio" | "studio_plus";
  shows: PackShow[];
};

// The JSON modules are typed structurally; widen each to the pack shape (a plain widening cast, not
// `any`) so the registry is strongly typed downstream. Order = display order on the packs grid.
export const PODCAST_PACKS: readonly PodcastPack[] = [
  contractor as PodcastPack,
  medSpa as PodcastPack,
  sales as PodcastPack,
];

/** Looks up a pack by its vertical slug, or null when no pack matches. */
export function getPodcastPack(slug: string): PodcastPack | null {
  return PODCAST_PACKS.find((p) => p.vertical_slug === slug) ?? null;
}
