// recent-purchases.ts — the data + pure helpers behind the live purchase-notification widget
// (PC-MARK-4). The landing page toast says "Someone from <City> just got Pocket Capture." using
// the last few real standalone purchases, anonymized to city only.
//
// Source of truth is the pocket_agent_addon_purchases ledger (migration 065, reused — no new
// migration this lane), filtered to kind=pocket_capture_standalone. The ledger row carries no
// city, so we resolve it from the buyer's Stripe Checkout Session billing address at read time.
// When Stripe never collected an address, the entry is skipped (SPEC §4.4-style honesty: no fake
// placeholders — the widget shows only purchases we can actually attribute to a city).
//
// Direct REST against Supabase + Stripe (standing rule, no SDK). Pure shaping helpers (extractCity,
// nextPurchaseIndex, message, dismissal) are import-free so the widget's rotation + the city
// fallbacks are unit-tested without the network.

import { z } from "zod";
import { paEnv, authHeaders } from "./supabase";
import { POCKET_CAPTURE_ADDON_KIND } from "./product";

// Pin the same Stripe API version the checkout route uses, so the session shape is stable.
const STRIPE_API_VERSION = "2024-09-30.acacia";

// How many recent purchases the widget rotates through.
export const RECENT_PURCHASES_LIMIT = 10;

// Server-side cache window. Stripe + Supabase are only hit once per this interval per warm instance.
export const RECENT_PURCHASES_CACHE_MS = 5 * 60_000;

// Widget timing (SPEC §4.3 / PC-MARK-4): each toast is visible 8s, then the next one appears every
// 12s (so an 8s-visible / 4s-gap cycle). Exported as constants so the React timing is testable.
export const PURCHASE_TOAST_VISIBLE_MS = 8_000;
export const PURCHASE_TOAST_GAP_MS = 12_000;

// localStorage key for the visitor's "stop showing me this" preference (the toast's X button).
export const PURCHASE_TOAST_DISMISS_KEY = "pc_purchase_toast_dismissed";

export type RecentPurchase = {
  /** City only — never name or email (anonymized social proof). */
  city: string;
  /** ISO timestamp the purchase was ledgered. */
  purchased_at: string;
};

// Boundary schema for the Stripe Checkout Session retrieve — only the one field we read. Everything
// is nullish because Stripe omits the address entirely when it wasn't collected for the charge.
const StripeSessionSchema = z.object({
  customer_details: z
    .object({ address: z.object({ city: z.string().nullish() }).nullish() })
    .nullish(),
});

/**
 * Pull a usable city out of a (parsed) Stripe Checkout Session object. Returns null when the
 * customer details, address, or city are absent or blank — the caller skips those entries. Pure.
 */
export function extractCity(session: unknown): string | null {
  const parsed = StripeSessionSchema.safeParse(session);
  if (!parsed.success) return null;
  const city = parsed.data.customer_details?.address?.city;
  if (typeof city !== "string") return null;
  const trimmed = city.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The toast copy. Voice-checked vs chase-spec §10: concrete (a real city), no banned phrase, no time
 * framing, reads aloud like a person. Matches SPEC §4.4's exact line. Pure.
 */
export function purchaseToastMessage(purchase: RecentPurchase): string {
  return `Someone from ${purchase.city} just got Pocket Capture.`;
}

/** Index of the next purchase to show, wrapping. 0 when there are none. Pure. */
export function nextPurchaseIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current + 1) % total;
}

/** Whether the visitor permanently dismissed the toast (raw localStorage value). Pure. */
export function isToastDismissed(raw: string | null): boolean {
  return raw === "1";
}

type LedgerRow = { stripe_session_id: string; created_at: string };

// The newest standalone-purchase ledger rows. Returns [] (and logs) on any infrastructure error so
// the widget falls back to its empty state rather than throwing the page.
async function fetchStandalonePurchaseRows(limit: number): Promise<LedgerRow[]> {
  const env = paEnv();
  if ("error" in env) {
    console.error("[pocket-capture/recent-purchases] supabase env missing", { error: env.error });
    return [];
  }

  const url =
    `${env.url}/rest/v1/pocket_agent_addon_purchases` +
    `?kind=eq.${encodeURIComponent(POCKET_CAPTURE_ADDON_KIND)}` +
    `&select=stripe_session_id,created_at&order=created_at.desc&limit=${limit}`;

  const res = await fetch(url, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) {
    console.error("[pocket-capture/recent-purchases] ledger read failed", {
      status: res.status,
      error: await res.text(),
    });
    return [];
  }
  const rows = (await res.json()) as unknown;
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (r): r is LedgerRow =>
      typeof r === "object" &&
      r !== null &&
      typeof (r as LedgerRow).stripe_session_id === "string" &&
      typeof (r as LedgerRow).created_at === "string",
  );
}

// Resolve the billing city for one Checkout Session. null when Stripe has no address on file or the
// retrieve fails (the entry is then skipped — no fake placeholder).
async function lookupCityForSession(
  sessionId: string,
  secret: string,
): Promise<string | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: { Authorization: `Bearer ${secret}`, "Stripe-Version": STRIPE_API_VERSION },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    console.error("[pocket-capture/recent-purchases] stripe session retrieve failed", {
      session_id: sessionId,
      status: res.status,
    });
    return null;
  }
  return extractCity(await res.json());
}

let cache: { at: number; data: RecentPurchase[] } | null = null;

/**
 * The recent standalone purchases for the social-proof widget, anonymized to city + timestamp.
 * Cached in-process for RECENT_PURCHASES_CACHE_MS so a busy landing page hits Stripe/Supabase at
 * most once per window. Entries whose city can't be resolved are dropped — the widget renders
 * nothing rather than fabricate a location.
 */
export async function getRecentPurchases(): Promise<RecentPurchase[]> {
  const now = Date.now();
  if (cache && now - cache.at < RECENT_PURCHASES_CACHE_MS) return cache.data;

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    console.error("[pocket-capture/recent-purchases] STRIPE_SECRET_KEY not set");
    cache = { at: now, data: [] };
    return [];
  }

  const rows = await fetchStandalonePurchaseRows(RECENT_PURCHASES_LIMIT);
  const resolved = await Promise.all(
    rows.map(async (row): Promise<RecentPurchase | null> => {
      const city = await lookupCityForSession(row.stripe_session_id, secret);
      return city ? { city, purchased_at: row.created_at } : null;
    }),
  );
  const data = resolved.filter((p): p is RecentPurchase => p !== null);
  cache = { at: now, data };
  return data;
}

/** Test-only: clear the in-process cache between cases. */
export function __resetRecentPurchasesCache(): void {
  cache = null;
}
