// enrichers/sales-nav.ts — the Sales Navigator adapter (SPEC §3, §13 — DEFERRED).
//
// Sales Navigator's API is invite-only/restricted (SPEC §13 open question 2), so this adapter is a
// deliberate stub: it reports configured only when SALES_NAV_API_KEY is set, and even then returns a
// clean "not wired yet" error rather than a scrape. Selecting sales_nav in the search UI surfaces a
// "connect Sales Navigator" state — we do NOT roll our own LinkedIn scraper to cover it (SPEC §11).
// When the owner's other enrichment connector covers Sales Nav's fields (the SPEC's default), this
// stays a stub; if a real proxy lands later, implement search() here and the dispatcher picks it up.

import type { SearchParams } from "../types";
import type { Enricher, EnricherResult } from "./types";

function salesNavKey(): string | null {
  const k = process.env.SALES_NAV_API_KEY;
  return k && k.length > 0 ? k : null;
}

export const salesNavEnricher: Enricher = {
  source: "sales_nav",
  isConfigured: () => salesNavKey() !== null,
  async search(_params: SearchParams, _limit: number): Promise<EnricherResult> {
    if (!salesNavKey()) return { configured: false };
    // Key present but the proxy isn't built — surface honestly, never scrape (SPEC §11/§13).
    return {
      configured: true,
      ok: false,
      error:
        "Sales Navigator search isn't wired yet — connect Apollo, Clay, or Common Room to run this search, or wait for the Sales Nav proxy.",
    };
  },
};
