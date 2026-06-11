// Ad library types — the structured shape behind the Part 6 ad system
// (GPT-Hormozi voice). Copy is filed byte-for-byte from
// brain/marketing/copy-drafts/chatgpt-6a29aaa5/parts/part-6-ads-niche-campaigns.md.
// A future Lead Ad management surface imports this manifest to export ads to
// Meta / TikTok / LinkedIn.

/**
 * Which funnel campaign an ad belongs to (Part 6B campaign architecture).
 */
export type AdCampaign =
  | "cold-vsl"
  | "cold-webinar"
  | "idea-engine"
  | "lead-scout"
  | "retargeting";

/**
 * Editorial grouping used by getAdsByCategory(). Maps an ad to the product
 * surface or offer it leads with.
 */
export type AdCategory =
  | "mechanism"
  | "business-brain"
  | "personas"
  | "mission-control"
  | "follow-up"
  | "email"
  | "capture"
  | "apps"
  | "idea-engine"
  | "lead-scout"
  | "launch-kit"
  | "pilot"
  | "pricing"
  | "audience"
  | "webinar";

/** A short-form video ad (Part 6C). */
export interface Ad {
  id: string;
  hook: string;
  script: string;
  cta: string;
  campaign: AdCampaign;
  category: AdCategory;
}

/** A retargeting ad (Part 6D). Extends Ad with the warm audience segment. */
export interface RetargetingAd extends Ad {
  audience: string;
}

/** A static image ad — one primary-text variation (Part 6F). */
export interface StaticAd {
  id: string;
  headline: string;
  primary_text: string;
  cta: string;
}

/**
 * A niche campaign (Part 6G–6P). Some niches carry the full positioning block;
 * the seven Lead-Scout verticals (Part 6J–6P) ship only the hero + ad in the
 * source, so the positioning fields are optional and filled only where the
 * source provides them — no invented copy.
 */
export interface NicheCampaign {
  id: string;
  niche: string;
  positioning?: string;
  core_promise?: string;
  main_pain?: string;
  best_personas?: string[];
  best_apps?: string[];
  landing_page_hero: {
    headline: string;
    subheadline: string;
    cta: string;
  };
  ad: {
    hook: string;
    script: string;
    cta: string;
  };
}
