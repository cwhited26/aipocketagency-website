// checkout.ts — the §22.1 step-7 conversion path: the value-ask link in the WhatsApp thread is
// a SIGNED handle onto the trial thread, and the redirect route turns it into a one-tap Stripe
// Checkout Session stamped with metadata.trial_thread_id. The raw phone never rides the link
// or the Stripe metadata — only the opaque thread_id UUID.
//
// The session subscribes the Starter tier ($37/mo, the §22.1 ask). subscription metadata gets
// source "pocket_agent_whatsapp_trial" — NOT "pocket_agent" — because the pay-first machinery
// keys on email metadata we don't have for a cold sender; the migration webhook owns account
// creation from session.customer_details instead (migrate.ts).

import { signState, verifyState, DecryptionError } from "@/lib/crypto/encrypt";
import { priceIdForCheckout } from "@/lib/pocket-agent-checkout";
import { TRIAL_TTL_MS } from "./types";

export const WHATSAPP_TRIAL_CHECKOUT_SOURCE = "pocket_agent_whatsapp_trial";

const SITE_ORIGIN = "https://aipocketagent.com";

// ── Signed link (rides the WhatsApp thread) ──────────────────────────────────────────────────

type CheckoutToken = { threadId: string; iat: number };

export function buildTrialCheckoutToken(threadId: string, now: Date = new Date()): string {
  const body: CheckoutToken = { threadId, iat: now.getTime() };
  return signState(JSON.stringify(body));
}

/** The URL Poc sends. The route creates the Stripe session on tap, not eagerly. */
export function buildTrialCheckoutUrl(threadId: string): string {
  return `${SITE_ORIGIN}/api/whatsapp-trial/checkout?t=${encodeURIComponent(
    buildTrialCheckoutToken(threadId),
  )}`;
}

export type TokenVerification =
  | { ok: true; threadId: string }
  | { ok: false; reason: "invalid" | "expired" };

/** Verify a tapped link token. Links age out with the trial TTL. */
export function verifyTrialCheckoutToken(
  token: string,
  now: Date = new Date(),
): TokenVerification {
  let body: string;
  try {
    body = verifyState(token);
  } catch (err) {
    if (err instanceof DecryptionError) return { ok: false, reason: "invalid" };
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (typeof parsed !== "object" || parsed === null) return { ok: false, reason: "invalid" };
  const threadId = (parsed as Record<string, unknown>).threadId;
  const iat = (parsed as Record<string, unknown>).iat;
  if (typeof threadId !== "string" || threadId.length === 0 || typeof iat !== "number") {
    return { ok: false, reason: "invalid" };
  }
  if (now.getTime() - iat > TRIAL_TTL_MS) return { ok: false, reason: "expired" };
  return { ok: true, threadId };
}

// ── Stripe session params ────────────────────────────────────────────────────────────────────

export type TrialCheckoutParams =
  | { ok: true; params: URLSearchParams }
  | { ok: false; error: string };

/** The Checkout Session params for a trial migration. Pure — exported for tests. */
export function buildWhatsappTrialCheckoutParams(threadId: string): TrialCheckoutParams {
  const priceId = priceIdForCheckout("starter");
  if (!priceId) return { ok: false, error: "No Stripe price configured for tier 'starter'" };

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  // No customer_email: cold senders gave us a phone, not an address. Stripe collects it and
  // the migration webhook reads session.customer_details.email.
  params.set("metadata[source]", WHATSAPP_TRIAL_CHECKOUT_SOURCE);
  params.set("metadata[trial_thread_id]", threadId);
  params.set("metadata[tier]", "starter");
  params.set("subscription_data[metadata][source]", WHATSAPP_TRIAL_CHECKOUT_SOURCE);
  params.set("subscription_data[metadata][trial_thread_id]", threadId);
  params.set("subscription_data[metadata][tier]", "starter");
  params.set("client_reference_id", `whatsapp_trial:${threadId}`);
  params.set("success_url", `${SITE_ORIGIN}/whatsapp?migrated=1`);
  params.set("cancel_url", `${SITE_ORIGIN}/whatsapp?canceled=1`);
  return { ok: true, params };
}
