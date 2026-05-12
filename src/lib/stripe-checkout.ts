import { getKitConfig, isKitSlug, type KitSlug } from "./kit-config";

type LeadContext = {
  leadId: string;
  email: string;
  name: string;
  phone: string;
  source: string;
};

type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

type PriceLookupResult =
  | { ok: true; priceId: string }
  | { ok: false; status: number; error: string };

/**
 * Runtime price-ID lookup keyed by `metadata.kit_slug`.
 *
 * Per the Pipeline Playbook (§Stripe wiring), we do NOT hardcode price IDs in
 * route files. Stripe is the source of truth: products and prices both carry
 * `metadata.kit_slug = '<slug>'`, and this helper resolves the active price at
 * request time. Cache TTL is 1 hour so we don't hammer the API on every checkout.
 */
const PRICE_CACHE_TTL_MS = 60 * 60 * 1000;
type CacheEntry = { priceId: string; expiresAt: number };
const priceCache = new Map<KitSlug, CacheEntry>();

async function lookupPriceIdForKit(
  slug: KitSlug,
  secret: string,
): Promise<PriceLookupResult> {
  const cached = priceCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, priceId: cached.priceId };
  }

  // `prices/search` is the canonical way to query by metadata. We constrain to
  // active prices so a deprecated/archived price never gets resold. The
  // Whited Stripe account's default API version pre-dates Search — pin a
  // modern version per-call rather than bumping the account default (which
  // would ripple across every other Stripe webhook this account already serves).
  const query = `active:'true' AND metadata['kit_slug']:'${slug}'`;
  const url = `https://api.stripe.com/v1/prices/search?query=${encodeURIComponent(query)}&limit=2`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${secret}`,
      "Stripe-Version": "2024-09-30.acacia",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  const body = (await res.json()) as {
    data?: Array<{ id: string; active: boolean; metadata?: Record<string, string> }>;
  };
  const matches = (body.data ?? []).filter((p) => p.active && p.metadata?.kit_slug === slug);
  if (matches.length === 0) {
    return {
      ok: false,
      status: 404,
      error: `No active Stripe price with metadata.kit_slug='${slug}'`,
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      status: 409,
      error: `Multiple active Stripe prices with metadata.kit_slug='${slug}': ${matches
        .map((m) => m.id)
        .join(", ")} — archive duplicates before checkout.`,
    };
  }

  const priceId = matches[0].id;
  priceCache.set(slug, { priceId, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
  return { ok: true, priceId };
}

export async function createKitCheckout(
  ctx: LeadContext,
  origin: string,
): Promise<CheckoutResult> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { ok: false, status: 500, error: "STRIPE_SECRET_KEY not set" };
  }

  if (!isKitSlug(ctx.source)) {
    return { ok: false, status: 400, error: `Unknown kit source: ${ctx.source}` };
  }
  const kit = getKitConfig(ctx.source);
  if (!kit) {
    return { ok: false, status: 400, error: `Unknown kit source: ${ctx.source}` };
  }

  const priceLookup = await lookupPriceIdForKit(kit.slug, secret);
  if (!priceLookup.ok) {
    return priceLookup;
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("customer_email", ctx.email);
  params.set("client_reference_id", ctx.leadId);
  params.set(
    "success_url",
    `${origin}/${kit.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
  );
  params.set("cancel_url", `${origin}/${kit.slug}/checkout?cancelled=1`);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price]", priceLookup.priceId);
  params.set("metadata[lead_id]", ctx.leadId);
  params.set("metadata[name]", ctx.name);
  params.set("metadata[phone]", ctx.phone);
  params.set("metadata[source]", ctx.source);
  params.set("metadata[kit_slug]", ctx.source);
  params.set("payment_intent_data[metadata][lead_id]", ctx.leadId);
  params.set("payment_intent_data[metadata][source]", ctx.source);
  params.set("payment_intent_data[metadata][kit_slug]", ctx.source);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    return { ok: false, status: 500, error: "Stripe response missing url" };
  }
  return { ok: true, url: data.url };
}

/** Legacy alias retained for older callers. New code should use `createKitCheckout`. */
export const createDispatchPlaybookCheckout = createKitCheckout;
