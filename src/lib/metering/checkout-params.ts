// Pure Stripe Checkout param builders for the metering one-time charges (PA-POS-30/31):
// Top Up bundles and Project Passes. Mirrors pocket-agent-addon-checkout.ts (the Fast-Start /
// funnel precedent) — mode=payment, inline price_data, metadata stamped on BOTH the session and
// the payment intent so the webhook can ledger from either object. Framework-free so the param
// shaping is unit-tested without the network.

import type { TopUpBundle } from "@/data/top-ups";
import type { ProjectPassDef } from "@/data/project-passes";

export const PA_METERING_CHECKOUT_SOURCE = "pa_metering";

type CommonArgs = {
  origin: string;
  successPath: string;
  cancelPath: string;
  userId: string;
  email: string | null;
  tier: string;
};

function baseParams(args: CommonArgs & { name: string; amountCents: number }): URLSearchParams {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][product_data][name]", args.name);
  params.set("line_items[0][price_data][unit_amount]", String(args.amountCents));
  params.set("line_items[0][quantity]", "1");
  if (args.email) params.set("customer_email", args.email);
  params.set("client_reference_id", args.userId);
  params.set("metadata[source]", PA_METERING_CHECKOUT_SOURCE);
  params.set("metadata[user_id]", args.userId);
  params.set("metadata[tier_at_purchase]", args.tier);
  params.set("payment_intent_data[metadata][source]", PA_METERING_CHECKOUT_SOURCE);
  params.set("success_url", `${args.origin}${args.successPath}`);
  params.set("cancel_url", `${args.origin}${args.cancelPath}`);
  return params;
}

export function buildTopUpCheckoutParams(args: CommonArgs & { bundle: TopUpBundle }): URLSearchParams {
  const params = baseParams({ ...args, name: args.bundle.name, amountCents: args.bundle.amountCents });
  params.set("metadata[metering_kind]", "top_up");
  params.set("metadata[bundle_id]", args.bundle.id);
  params.set("metadata[credits]", String(args.bundle.credits));
  return params;
}

export function buildProjectPassCheckoutParams(
  args: CommonArgs & { def: ProjectPassDef; priceCents: number },
): URLSearchParams {
  const params = baseParams({ ...args, name: args.def.checkoutName, amountCents: args.priceCents });
  params.set("metadata[metering_kind]", "project_pass");
  params.set("metadata[app_slug]", args.def.appSlug);
  return params;
}
