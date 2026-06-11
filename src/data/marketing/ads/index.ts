// Ad library manifest — the Part 6 ad system as a typed, exportable surface.
// A future Lead Ad management surface imports from here to push ads to
// Meta / TikTok / LinkedIn. Copy is filed byte-for-byte from
// brain/marketing/copy-drafts/chatgpt-6a29aaa5/parts/part-6-ads-niche-campaigns.md
// (GPT-Hormozi voice — intentional, not Chase voice).

export type {
  Ad,
  RetargetingAd,
  StaticAd,
  NicheCampaign,
  AdCampaign,
  AdCategory,
} from "./types";
import type { Ad, AdCategory, NicheCampaign } from "./types";

export { SHORT_FORM_ADS } from "./short-form";
export { RETARGETING_ADS } from "./retargeting";
export { STATIC_HEADLINES } from "./static-headlines";
export { STATIC_PRIMARY_TEXT } from "./static-primary-text";
export { NICHE_CAMPAIGNS } from "./niche-campaigns";

import { SHORT_FORM_ADS } from "./short-form";
import { RETARGETING_ADS } from "./retargeting";
import { NICHE_CAMPAIGNS } from "./niche-campaigns";

/**
 * Every ad that carries a category — the 30 short-form video ads plus the 10
 * retargeting ads (RetargetingAd extends Ad). Useful for one flat sweep.
 */
export const ALL_CATEGORIZED_ADS: Ad[] = [
  ...SHORT_FORM_ADS,
  ...RETARGETING_ADS,
];

/** Return every short-form and retargeting ad in the given category. */
export function getAdsByCategory(category: AdCategory): Ad[] {
  return ALL_CATEGORIZED_ADS.filter((ad) => ad.category === category);
}

/** Return the niche campaign for the given niche id (e.g. "roofing"), or undefined. */
export function getAdsByNiche(niche: string): NicheCampaign | undefined {
  return NICHE_CAMPAIGNS.find((campaign) => campaign.id === niche);
}
