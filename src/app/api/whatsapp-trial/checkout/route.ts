// /api/whatsapp-trial/checkout — the value-ask link's landing (PA-POS-32 §22.1 step 7). Poc
// sends a SIGNED thread token; this route verifies it, creates the Stripe Checkout Session
// stamped with metadata.trial_thread_id, and 303s the sender straight into Stripe. Sessions
// are created on tap, not eagerly — a value ask nobody taps costs nothing.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildWhatsappTrialCheckoutParams,
  verifyTrialCheckoutToken,
} from "@/lib/onboarding/whatsapp-cold/checkout";
import { fetchTrialThreadByThreadId } from "@/lib/onboarding/whatsapp-cold/db";
import { coldLog } from "@/lib/onboarding/whatsapp-cold/log";
import { hashPhoneForLog } from "@/lib/onboarding/whatsapp-cold/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({ t: z.string().min(1).max(2_048) });

function bounce(reason: string): NextResponse {
  // A dead link lands on the marketing page, not an error blob — the sender is on a phone.
  return NextResponse.redirect(`https://aipocketagent.com/whatsapp?link=${reason}`, 303);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const parsed = QuerySchema.safeParse({ t: req.nextUrl.searchParams.get("t") });
  if (!parsed.success) return bounce("invalid");

  const token = verifyTrialCheckoutToken(parsed.data.t);
  if (!token.ok) return bounce(token.reason);

  const threadRes = await fetchTrialThreadByThreadId(token.threadId);
  if (!threadRes.ok || !threadRes.data) return bounce("gone");
  const thread = threadRes.data;
  if (thread.status === "converted") return bounce("already");

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    coldLog.error("trial checkout: STRIPE_SECRET_KEY not set");
    return bounce("unavailable");
  }
  const params = buildWhatsappTrialCheckoutParams(thread.thread_id);
  if (!params.ok) {
    coldLog.error("trial checkout: params unbuildable", { error: params.error });
    return bounce("unavailable");
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-09-30.acacia",
    },
    body: params.params.toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    coldLog.error("trial checkout: Stripe session creation failed", {
      sender: hashPhoneForLog(thread.sender_phone),
      status: res.status,
    });
    return bounce("unavailable");
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) return bounce("unavailable");

  coldLog.info("trial checkout session created", {
    sender: hashPhoneForLog(thread.sender_phone),
  });
  return NextResponse.redirect(data.url, 303);
}
