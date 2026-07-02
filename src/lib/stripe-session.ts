// lib/stripe-session.ts — read a Checkout Session back from Stripe. /thanks uses this to recover the
// buyer's email and the anonymous_signup flag from the session_id in the success URL, so it can show
// the "log in to your workspace" section (and pre-fill the resend) for a pay-first buyer who has no
// browser session yet. Zod-validated at the Stripe boundary; zero any.

import { z } from "zod";

const SessionSchema = z.object({
  id: z.string(),
  customer_email: z.string().email().nullable().optional(),
  // Stripe returns metadata as a string→string map (or null when none was set).
  metadata: z.record(z.string(), z.string()).nullable().optional(),
});

export type CheckoutSessionSummary = {
  email: string | null;
  anonymousSignup: boolean;
  source: string | null;
};

type RetrieveResult =
  | { ok: true; session: CheckoutSessionSummary }
  | { ok: false; status: number; error: string };

/** Retrieve a Checkout Session's email + pay-first metadata. Never throws — /thanks degrades to the
 *  authenticated-vs-not check when this fails. */
export async function retrieveCheckoutSession(sessionId: string): Promise<RetrieveResult> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return { ok: false, status: 500, error: "STRIPE_SECRET_KEY not set" };

  let res: Response;
  try {
    res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: {
          Authorization: `Bearer ${secret}`,
          "Stripe-Version": "2024-09-30.acacia",
        },
        cache: "no-store",
      },
    );
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };

  const parsed = SessionSchema.safeParse(await res.json());
  if (!parsed.success) {
    return { ok: false, status: 502, error: `session parse failed: ${parsed.error.message}` };
  }
  return {
    ok: true,
    session: {
      email: parsed.data.customer_email ?? null,
      anonymousSignup: parsed.data.metadata?.anonymous_signup === "true",
      source: parsed.data.metadata?.source ?? null,
    },
  };
}
