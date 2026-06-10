// POST /api/cancel/confirm — actually cancel the owner's Pocket Agent subscription via direct Stripe
// REST (no SDK), enqueue the cancellation confirmation email, and log the attempt with saved=false.
// The subscription.deleted webhook also enqueues a confirmation, so the enqueue here is idempotency-safe
// against a double send only at the cadence level — both paths use the queue, and the cron will send
// whichever arrives first; the webhook's clear-pending-sequences keeps the rest tidy.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { insertCancellationAttempt, enqueueEmail } from "@/lib/emails/queue";
import { isCancelReasonSlug } from "@/lib/cancel/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serviceEnv(): { url: string; key: string } | null {
  const url = (
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL ??
    ""
  ).replace(/\/$/, "");
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY ??
    "";
  if (!url || !key) return null;
  return { url, key };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  let body: { reason?: unknown };
  try {
    body = (await req.json()) as { reason?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" && isCancelReasonSlug(body.reason) ? body.reason : "other";

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

  const env = serviceEnv();
  if (!env) return NextResponse.json({ error: "server misconfigured" }, { status: 500 });

  // Find the owner's active subscription id + email.
  const subRes = await fetch(
    `${env.url}/rest/v1/pocket_agent_subscriptions?user_id=eq.${encodeURIComponent(user.id)}` +
      `&select=stripe_subscription_id,email,name&order=created_at.desc&limit=1`,
    { headers: { apikey: env.key, Authorization: `Bearer ${env.key}` }, cache: "no-store" },
  );
  if (!subRes.ok) {
    return NextResponse.json({ error: "subscription lookup failed" }, { status: 502 });
  }
  const rows = (await subRes.json()) as Array<{
    stripe_subscription_id: string | null;
    email: string;
    name: string | null;
  }>;
  const sub = rows[0];
  if (!sub || !sub.stripe_subscription_id) {
    return NextResponse.json({ error: "no active subscription" }, { status: 404 });
  }

  // Cancel at period end is the friendlier default, but the save flow intent is "cancel now" — the GPT
  // confirmation copy says the subscription "has been canceled". Use immediate cancellation (DELETE).
  const cancelRes = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(sub.stripe_subscription_id)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${stripeKey}` },
    },
  );
  if (!cancelRes.ok) {
    const errBody = await cancelRes.text();
    console.error("[cancel/confirm] Stripe cancel failed", {
      owner_id: user.id,
      subscription_id: sub.stripe_subscription_id,
      status: cancelRes.status,
      error: errBody.slice(0, 500),
    });
    return NextResponse.json({ error: "cancel failed" }, { status: 502 });
  }

  // Log the confirmed cancel (saved=false). Best-effort; never blocks the user's confirmation.
  const logged = await insertCancellationAttempt({ ownerId: user.id, reason, saved: false });
  if (!logged.ok) {
    console.error("[cancel/confirm] failed to log attempt", {
      owner_id: user.id,
      reason,
      error: logged.error,
    });
  }

  // Enqueue the cancellation confirmation email. The customer.subscription.deleted webhook will also
  // fire once Stripe delivers the event; both ride the queue so the cron sends the first that lands.
  const conf = await enqueueEmail({
    ownerId: user.id,
    email: sub.email,
    templateSlug: "cancellation.confirmation",
    templateProps: { email: sub.email, firstName: sub.name },
    sequenceSlug: null,
    sendAt: new Date().toISOString(),
  });
  if (!conf.ok) {
    console.error("[cancel/confirm] failed to enqueue confirmation email", {
      owner_id: user.id,
      error: conf.error,
    });
  }

  return NextResponse.json({ ok: true });
}
