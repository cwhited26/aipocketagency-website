import { getKitConfig, isKitSlug, type KitSlug } from "./kit-config";

type LeadContext = {
  leadId: string;
  email: string;
  name: string;
  phone: string;
  source: string;
  /**
   * If set, the buyer accepted the $10 order bump on the checkout page.
   * The checkout session includes a second line item for the bump kit's
   * $10 add-on price (looked up by `metadata.bump_price = 'true'`).
   */
  bumpSlug?: KitSlug;
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
const bumpPriceCache = new Map<KitSlug, CacheEntry>();

async function searchActivePrice(
  slug: KitSlug,
  secret: string,
  filter: (p: { active: boolean; metadata?: Record<string, string> }) => boolean,
  filterLabel: string,
): Promise<PriceLookupResult> {
  // `prices/search` is the canonical way to query by metadata. We constrain to
  // active prices so a deprecated/archived price never gets resold. The
  // Whited Stripe account's default API version pre-dates Search — pin a
  // modern version per-call rather than bumping the account default (which
  // would ripple across every other Stripe webhook this account already serves).
  const query = `active:'true' AND metadata['kit_slug']:'${slug}'`;
  const url = `https://api.stripe.com/v1/prices/search?query=${encodeURIComponent(query)}&limit=5`;
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
  const matches = (body.data ?? []).filter(filter);
  if (matches.length === 0) {
    return {
      ok: false,
      status: 404,
      error: `No active Stripe price for ${filterLabel} kit_slug='${slug}'`,
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      status: 409,
      error: `Multiple active Stripe prices for ${filterLabel} kit_slug='${slug}': ${matches
        .map((m) => m.id)
        .join(", ")} — archive duplicates before checkout.`,
    };
  }
  return { ok: true, priceId: matches[0].id };
}

async function lookupPriceIdForKit(
  slug: KitSlug,
  secret: string,
): Promise<PriceLookupResult> {
  const cached = priceCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, priceId: cached.priceId };
  }
  const result = await searchActivePrice(
    slug,
    secret,
    (p) =>
      p.active &&
      p.metadata?.kit_slug === slug &&
      p.metadata?.bump_price !== "true",
    "primary",
  );
  if (result.ok) {
    priceCache.set(slug, { priceId: result.priceId, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
  }
  return result;
}

/**
 * Lookup the `$10 bump_price = true` price for a given kit slug. The bump
 * price exists alongside the standard $15 price under the same Stripe
 * product, with `metadata.bump_price = 'true'` discriminating it.
 */
async function lookupBumpPriceIdForKit(
  slug: KitSlug,
  secret: string,
): Promise<PriceLookupResult> {
  const cached = bumpPriceCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, priceId: cached.priceId };
  }
  const result = await searchActivePrice(
    slug,
    secret,
    (p) =>
      p.active &&
      p.metadata?.kit_slug === slug &&
      p.metadata?.bump_price === "true",
    "bump",
  );
  if (result.ok) {
    bumpPriceCache.set(slug, { priceId: result.priceId, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
  }
  return result;
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

  // Order bump (Russell-style): +$10 second line item for the kit listed in
  // `kit.bumpTarget`. Looked up by `metadata.bump_price = 'true'` so a future
  // price rename never silently re-prices the bump.
  let bumpPriceId: string | null = null;
  let bumpSlug: KitSlug | null = null;
  if (ctx.bumpSlug) {
    if (ctx.bumpSlug === kit.slug) {
      return {
        ok: false,
        status: 400,
        error: `Bump target cannot match primary kit: ${ctx.bumpSlug}`,
      };
    }
    if (!getKitConfig(ctx.bumpSlug)) {
      return {
        ok: false,
        status: 400,
        error: `Unknown bump kit: ${ctx.bumpSlug}`,
      };
    }
    const bumpLookup = await lookupBumpPriceIdForKit(ctx.bumpSlug, secret);
    if (!bumpLookup.ok) {
      return bumpLookup;
    }
    bumpPriceId = bumpLookup.priceId;
    bumpSlug = ctx.bumpSlug;
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("customer_email", ctx.email);
  params.set("client_reference_id", ctx.leadId);
  // Bundle interstitial now happens BEFORE Stripe (the funnel asks pair +
  // bundle inline, then mints the right session). Success goes straight to
  // the Skool community pitch.
  params.set(
    "success_url",
    `${origin}/skool-invite/{CHECKOUT_SESSION_ID}`,
  );
  params.set(
    "cancel_url",
    `${origin}/${kit.slug}/upgrade-bundle/${encodeURIComponent(ctx.leadId)}?pair=${ctx.bumpSlug ? "1" : "0"}&cancelled=1`,
  );
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price]", priceLookup.priceId);
  if (bumpPriceId && bumpSlug) {
    params.set("line_items[1][quantity]", "1");
    params.set("line_items[1][price]", bumpPriceId);
    params.set("metadata[bump_kit_slug]", bumpSlug);
    params.set("payment_intent_data[metadata][bump_kit_slug]", bumpSlug);
  }
  params.set("metadata[lead_id]", ctx.leadId);
  params.set("metadata[name]", ctx.name);
  params.set("metadata[phone]", ctx.phone);
  params.set("metadata[source]", ctx.source);
  params.set("metadata[kit_slug]", ctx.source);
  params.set("metadata[funnel_stage]", "primary");
  params.set("payment_intent_data[metadata][lead_id]", ctx.leadId);
  params.set("payment_intent_data[metadata][source]", ctx.source);
  params.set("payment_intent_data[metadata][kit_slug]", ctx.source);
  params.set("payment_intent_data[metadata][funnel_stage]", "primary");

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

type RetrievedSession = {
  id: string;
  client_reference_id: string | null;
  customer: string | null;
  customer_email: string | null;
  payment_status: string;
  amount_total: number | null;
  metadata: Record<string, string> | null;
};

type RetrieveResult =
  | { ok: true; session: RetrievedSession }
  | { ok: false; status: number; error: string };

/** Pull a Checkout Session by id — used by the bundle / skool funnel pages. */
export async function retrieveCheckoutSession(
  sessionId: string,
): Promise<RetrieveResult> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { ok: false, status: 500, error: "STRIPE_SECRET_KEY not set" };
  }
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: {
        Authorization: `Bearer ${secret}`,
        "Stripe-Version": "2024-09-30.acacia",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  const session = (await res.json()) as RetrievedSession;
  return { ok: true, session };
}

type BundleCheckoutArgs = {
  leadId: string;
  email: string;
  /** The kit slug the buyer started the funnel from — preserved on the
   *  session metadata so wc-admin attribution still tracks "first touch". */
  originSlug: KitSlug;
  /** Bundle price in cents (canonically `BUNDLE_PRICING.offerUsd * 100`). */
  unitAmountCents: number;
};

/**
 * Mint a Stripe Checkout Session for the all-5-kit bundle.
 *
 * Single inline `price_data` line item at the bundle price. The webhook
 * branches on `funnel_stage = bundle_upgrade` to deliver all 5 PDFs and
 * stamp `apa_leads.bundle_upgraded = true`. Used by the inline funnel
 * after the buyer accepts the bundle pitch on /upgrade-bundle.
 */
export async function createBundleCheckout(
  args: BundleCheckoutArgs,
  origin: string,
): Promise<CheckoutResult> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { ok: false, status: 500, error: "STRIPE_SECRET_KEY not set" };
  }
  if (args.unitAmountCents <= 0) {
    return {
      ok: false,
      status: 400,
      error: `Bundle price must be > 0, got ${args.unitAmountCents}`,
    };
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("customer_email", args.email);
  params.set("client_reference_id", args.leadId);
  params.set(
    "success_url",
    `${origin}/skool-invite/{CHECKOUT_SESSION_ID}?bundled=1`,
  );
  params.set(
    "cancel_url",
    `${origin}/${args.originSlug}/upgrade-bundle/${encodeURIComponent(args.leadId)}?pair=0&cancelled=1`,
  );
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set(
    "line_items[0][price_data][product_data][name]",
    "APA Kit Bundle — all 5 kits",
  );
  params.set(
    "line_items[0][price_data][product_data][description]",
    "All five APA kits: Dispatch Playbook, Dev-Team Document Set, CLAUDE.md Template Library, Discovery → MVP Prompt Pack, Wire-the-Brain-to-Stack.",
  );
  params.set("line_items[0][price_data][unit_amount]", String(args.unitAmountCents));
  params.set("metadata[lead_id]", args.leadId);
  params.set("metadata[origin_kit_slug]", args.originSlug);
  params.set("metadata[kit_slug]", args.originSlug);
  params.set("metadata[source]", args.originSlug);
  params.set("metadata[funnel_stage]", "bundle_upgrade");
  params.set("payment_intent_data[metadata][lead_id]", args.leadId);
  params.set("payment_intent_data[metadata][source]", args.originSlug);
  params.set("payment_intent_data[metadata][kit_slug]", args.originSlug);
  params.set("payment_intent_data[metadata][funnel_stage]", "bundle_upgrade");

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
