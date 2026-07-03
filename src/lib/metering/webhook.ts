// Webhook completion handler for pa_metering checkouts (PA-POS-30/31). Called from
// /api/stripe/webhook on checkout.session.completed when metadata.source === "pa_metering".
// Zod validates the session fields we depend on; both writers are idempotent by
// stripe_session_id, so Stripe retries can't double-grant credits or passes.
//
// Customer autonomy (PA-POS-31 amendment): there is no purchase-count check anywhere on this
// path. The 3rd pass for the same App ledgers exactly like the 1st — full price, no block.

import { z } from "zod";
import { getPassDef, isPassAppSlug } from "@/data/project-passes";
import { insertProjectPass, insertTopUpPurchase } from "./store";

const DAY_MS = 24 * 60 * 60 * 1000;

const TopUpSessionSchema = z.object({
  id: z.string().min(1),
  amount_total: z.number().int().nonnegative(),
  metadata: z.object({
    metering_kind: z.literal("top_up"),
    user_id: z.string().uuid(),
    credits: z.coerce.number().int().positive(),
  }),
});

const PassSessionSchema = z.object({
  id: z.string().min(1),
  amount_total: z.number().int().nonnegative(),
  metadata: z.object({
    metering_kind: z.literal("project_pass"),
    user_id: z.string().uuid(),
    app_slug: z.string().refine(isPassAppSlug, "unknown pass app_slug"),
    tier_at_purchase: z.string().min(1),
  }),
});

export async function handlePaMeteringCompleted(session: {
  id: string;
  amount_total: number | null;
  metadata: Record<string, string> | null;
}): Promise<void> {
  const kind = session.metadata?.metering_kind;

  if (kind === "top_up") {
    const parsed = TopUpSessionSchema.safeParse(session);
    if (!parsed.success) {
      console.error("[metering/webhook] top_up session failed validation", {
        session_id: session.id,
        error: parsed.error.message,
      });
      return;
    }
    const result = await insertTopUpPurchase({
      ownerId: parsed.data.metadata.user_id,
      stripeSessionId: parsed.data.id,
      creditsAdded: parsed.data.metadata.credits,
      amountPaidCents: parsed.data.amount_total,
    });
    if (!result.ok) {
      console.error("[metering/webhook] top_up ledger write failed", {
        session_id: session.id,
        status: result.status,
        error: result.error,
      });
      return;
    }
    console.info("[metering/webhook] top_up credited", {
      session_id: session.id,
      credits: parsed.data.metadata.credits,
      amount_cents: parsed.data.amount_total,
    });
    return;
  }

  if (kind === "project_pass") {
    const parsed = PassSessionSchema.safeParse(session);
    if (!parsed.success) {
      console.error("[metering/webhook] project_pass session failed validation", {
        session_id: session.id,
        error: parsed.error.message,
      });
      return;
    }
    const appSlug = parsed.data.metadata.app_slug;
    const def = getPassDef(appSlug);
    if (!def) {
      console.error("[metering/webhook] project_pass app not in catalog", {
        session_id: session.id,
        app_slug: appSlug,
      });
      return;
    }
    const result = await insertProjectPass({
      ownerId: parsed.data.metadata.user_id,
      appSlug,
      expiresAt: new Date(Date.now() + def.windowDays * DAY_MS).toISOString(),
      remainingRunBudget: def.kind === "run" ? def.runBudget : null,
      pricePaidCents: parsed.data.amount_total,
      tierAtPurchase: parsed.data.metadata.tier_at_purchase,
      stripeSessionId: parsed.data.id,
    });
    if (!result.ok) {
      console.error("[metering/webhook] project_pass write failed", {
        session_id: session.id,
        status: result.status,
        error: result.error,
      });
      return;
    }
    console.info("[metering/webhook] project_pass granted", {
      session_id: session.id,
      app_slug: appSlug,
      window: def.windowLabel,
      amount_cents: parsed.data.amount_total,
    });
    return;
  }

  console.error("[metering/webhook] unknown metering_kind", {
    session_id: session.id,
    metering_kind: kind ?? null,
  });
}
