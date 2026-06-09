// packs.ts — Lead Scout Phase 4 (vertical pre-built packs).
//
// A pack is a pre-tuned Lead Source the owner subscribes to in one tap: a vertical-specific Google
// Maps category, default filters (no-website on, a review floor that fits the vertical), a radius
// preset, and an outreach voice brief that makes the cold email read roofing-specific vs law-firm-
// specific. The pack configs are static JSON in the repo (src/data/lead-scout-packs/<vertical>.json),
// not rows — subscribing creates a normal pa_lead_scout_sources row stamped with the pack_slug, so a
// subscribed source is just a Maps sweep that came pre-filled. This loader reads the JSON, types it,
// and turns a pack + a location into the MapsSweepConfig the Phase-2 sweep already runs.

import type { OutreachTone } from "@/lib/pa-drafts";
import type { MapsSweepConfig } from "./types";

import roofing from "@/data/lead-scout-packs/roofing.json";
import hvac from "@/data/lead-scout-packs/hvac.json";
import painting from "@/data/lead-scout-packs/painting.json";
import generalContracting from "@/data/lead-scout-packs/general-contracting.json";
import medSpa from "@/data/lead-scout-packs/med-spa.json";
import lawFirm from "@/data/lead-scout-packs/law-firm.json";
import dentist from "@/data/lead-scout-packs/dentist.json";

/** A pack's default filters — snake_case to match the JSON; mapped to MapsSweepFilters on use. */
export type PackFilters = {
  no_website: boolean;
  min_reviews: number | null;
  max_reviews: number | null;
  has_phone: boolean;
  has_email: boolean;
};

/** A vertical pack as it lives on disk + in memory. */
export type LeadScoutPack = {
  name: string;
  vertical_slug: string;
  /** Emoji shown on the pack card. */
  icon: string;
  /** Reader-friendly plural used in the batch card title ("roofers", "med spas"). */
  card_noun: string;
  tagline: string;
  display_description: string;
  default_google_maps_category: string;
  default_radius_miles: number;
  default_filters: PackFilters;
  default_outreach_tone: OutreachTone;
  /** One paragraph handed to the Email Drafter so the cold email reads vertical-specific. */
  outreach_voice_brief: string;
  recommended_tier: "studio" | "studio_plus";
};

// The JSON modules are typed structurally; cast each to the pack shape (a plain widening cast, not
// `any`) so the registry is strongly typed downstream. Order = display order on the packs grid.
export const LEAD_SCOUT_PACKS: readonly LeadScoutPack[] = [
  roofing as LeadScoutPack,
  hvac as LeadScoutPack,
  painting as LeadScoutPack,
  generalContracting as LeadScoutPack,
  medSpa as LeadScoutPack,
  lawFirm as LeadScoutPack,
  dentist as LeadScoutPack,
];

/** Look up a pack by its vertical slug ("roofing", "med-spa", …). Null when unknown. */
export function getPack(slug: string): LeadScoutPack | null {
  return LEAD_SCOUT_PACKS.find((p) => p.vertical_slug === slug) ?? null;
}

/** The outreach voice brief for a source's pack_slug, or null when the source isn't from a pack. */
export function voiceBriefFor(packSlug: string | null | undefined): string | null {
  if (!packSlug) return null;
  return getPack(packSlug)?.outreach_voice_brief ?? null;
}

/**
 * Turn a pack + an owner-supplied location into the Google Maps sweep criteria the Phase-2 pipeline
 * runs. The pack supplies category / radius / filters; the owner supplies only where to look.
 */
export function packToMapsConfig(pack: LeadScoutPack, location: string): MapsSweepConfig {
  return {
    category: pack.default_google_maps_category,
    location,
    radiusMiles: pack.default_radius_miles,
    filters: {
      noWebsite: pack.default_filters.no_website,
      minReviews: pack.default_filters.min_reviews,
      maxReviews: pack.default_filters.max_reviews,
      hasPhone: pack.default_filters.has_phone,
      hasEmail: pack.default_filters.has_email,
    },
  };
}
