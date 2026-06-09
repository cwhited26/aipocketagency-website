// Pocket Agent funnel v1 — the one-time add-on catalog (PA-FUNNEL).
//
// The funnel ladder is three subscription tiers (handled by pocket-agent-checkout.ts) plus four
// money-model products:
//   - AI Office Launch Kit — the continuity bonus included free with every subscription. $0; it is
//     not its own checkout, it rides the subscription. Present here so receipts + the value stack
//     have one canonical slug, and so the webhook never tries to charge for it.
//   - Done-With-You Setup Standard ($997) / Premium ($2,500) — the post-checkout upsell (/upsell),
//     charged once (Stripe mode=payment) tied to the customer from the prior subscription session.
//   - AI Agent Workspace Pilot ($97) — the downsell (/downsell) for a visitor who won't commit to a
//     subscription. Charged once; the $97 credits toward the subscription if they upgrade within 30d.
//
// Amounts live here (the single source of truth) and are passed inline to Stripe Checkout via
// price_data, so the one-time charges don't depend on a pre-created Stripe price living in the
// dashboard — the same direct-REST, no-SDK pattern the subscription flow uses. Kept free of
// Next.js / Stripe imports so the catalog is unit-tested in isolation.

/** The one-time products that produce an actual Stripe charge (excludes the $0 Launch Kit bonus). */
export type AddonCheckoutKind = "setup_standard" | "setup_premium" | "pilot";

/** Every funnel money-model product, including the $0 included bonus. */
export type AddonSlug =
  | "ai-office-launch-kit"
  | "done-with-you-setup-standard"
  | "done-with-you-setup-premium"
  | "ai-agent-workspace-pilot";

export type AddonProductMeta = {
  slug: AddonSlug;
  /** Display name as it appears on the Stripe receipt line item. */
  name: string;
  amountCents: number;
  /** The ?bought= branch /thanks shows after this product is purchased. */
  thanksBranch: ThanksBranch;
};

export type ThanksBranch =
  | "subscription_only"
  | "subscription_plus_setup"
  | "pilot";

// The catalog. Indexed by the checkout kind for the three charged products; the bonus is exported
// separately since it is never checked out.
export const ADDON_CATALOG: Record<AddonCheckoutKind, AddonProductMeta> = {
  setup_standard: {
    slug: "done-with-you-setup-standard",
    name: "Done-With-You Setup — Standard",
    amountCents: 99_700,
    thanksBranch: "subscription_plus_setup",
  },
  setup_premium: {
    slug: "done-with-you-setup-premium",
    name: "Done-With-You Setup — Premium",
    amountCents: 250_000,
    thanksBranch: "subscription_plus_setup",
  },
  pilot: {
    slug: "ai-agent-workspace-pilot",
    name: "AI Agent Workspace Pilot (14 days)",
    amountCents: 9_700,
    thanksBranch: "pilot",
  },
};

// The included bonus. $0, never charged, present so the slug + value framing have one home.
export const LAUNCH_KIT_BONUS: AddonProductMeta = {
  slug: "ai-office-launch-kit",
  name: "AI Office Launch Kit",
  amountCents: 0,
  thanksBranch: "subscription_only",
};

/** Type guard for an incoming `kind` param at the API boundary. */
export function isAddonCheckoutKind(value: unknown): value is AddonCheckoutKind {
  return (
    value === "setup_standard" ||
    value === "setup_premium" ||
    value === "pilot"
  );
}

export function getAddonMeta(kind: AddonCheckoutKind): AddonProductMeta {
  return ADDON_CATALOG[kind];
}

/** Dollar string for display, e.g. 99700 → "$997". Whole-dollar amounts only (no cents in copy). */
export function formatAddonPrice(amountCents: number): string {
  return `$${(amountCents / 100).toLocaleString("en-US")}`;
}
