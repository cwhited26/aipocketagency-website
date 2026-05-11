import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  insertApaEmailEvent,
  markApaLeadPaid,
} from "@/lib/wc-admin-supabase";
import { sendEmail } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const PDF_URL = "https://aipocketagency.com/dispatch-playbook.pdf";
const FROM = "Chase Whited <chase@aipocketagency.com>";
const SUBJECT = "Your Dispatch Playbook is here";

type StripeEvent = {
  id: string;
  type: string;
  livemode: boolean;
  data: {
    object: Record<string, unknown>;
  };
};

type CheckoutSession = {
  id: string;
  client_reference_id: string | null;
  customer: string | null;
  customer_email: string | null;
  payment_intent: string | null;
  amount_total: number | null;
  metadata: Record<string, string> | null;
};

function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): { ok: true } | { ok: false; reason: string } {
  if (!signatureHeader) {
    return { ok: false, reason: "missing signature header" };
  }
  const parts = signatureHeader.split(",").map((p) => p.trim());
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    if (k === "t") timestamp = v;
    else if (k === "v1") signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) {
    return { ok: false, reason: "malformed signature header" };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "non-numeric timestamp" };
  }
  const ageSec = Math.abs(Date.now() / 1000 - ts);
  if (ageSec > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: `timestamp outside tolerance (${ageSec}s)` };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");

  for (const sig of signatures) {
    const sigBuf = Buffer.from(sig, "utf8");
    if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "no matching v1 signature" };
}

function deliveryEmailHtml(): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px 16px;background:#0b0b0b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;">
<div style="max-width:560px;margin:0 auto;">
<p>You bought the Dispatch Playbook. It's attached.</p>
<p>Eleven sections. ~10,000 words. The operator manual for safely spawning parallel agents &mdash; written by someone who runs his businesses on the pattern.</p>
<p>Read it cover to cover. Try one fan-out lane next time you sit down at your desk. Your confidence is hands-on, not theoretical.</p>
<p>If the PDF doesn't open, <a href="${PDF_URL}" style="color:#6ee7b7;">download it directly here</a>.</p>
<p>If you want the full system the playbook lives inside &mdash; the brain pattern, the community, the live operators trading patterns weekly &mdash; that's at:</p>
<p><a href="https://aipocketagency.com" style="color:#6ee7b7;">aipocketagency.com</a></p>
<p style="margin-top:32px;">&mdash; Chase</p>
</div>
</body></html>`;
}

function deliveryEmailText(): string {
  return `You bought the Dispatch Playbook. It's attached.

Eleven sections. ~10,000 words. The operator manual for safely spawning parallel agents — written by someone who runs his businesses on the pattern.

Read it cover to cover. Try one fan-out lane next time you sit down at your desk. Your confidence is hands-on, not theoretical.

If the PDF doesn't open, the bundle is here: ${PDF_URL}

If you want the full system the playbook lives inside — the brain pattern, the community, the live operators trading patterns weekly — that's at:

aipocketagency.com

— Chase`;
}

async function handleCheckoutCompleted(session: CheckoutSession): Promise<void> {
  const leadId = session.client_reference_id;
  const email = session.customer_email;
  if (!leadId) {
    console.error("[stripe/webhook] checkout.session.completed missing client_reference_id", {
      session_id: session.id,
    });
    return;
  }

  const paid = await markApaLeadPaid({
    leadId,
    stripeCustomerId: session.customer,
    stripePaymentIntentId: session.payment_intent,
  });
  if (!paid.ok) {
    console.error("[stripe/webhook] failed to mark lead paid", {
      lead_id: leadId,
      session_id: session.id,
      status: paid.status,
      error: paid.error,
    });
  }

  if (!email) {
    console.error("[stripe/webhook] missing customer_email; skipping delivery", {
      lead_id: leadId,
      session_id: session.id,
    });
    return;
  }

  const send = await sendEmail({
    from: FROM,
    to: email,
    subject: SUBJECT,
    html: deliveryEmailHtml(),
    text: deliveryEmailText(),
    attachments: [{ filename: "dispatch-playbook.pdf", path: PDF_URL }],
  });

  if (!send.ok) {
    console.error("[stripe/webhook] Resend send failed", {
      lead_id: leadId,
      session_id: session.id,
      status: send.status,
      error: send.error,
    });
    const ev = await insertApaEmailEvent({
      leadId,
      emailId: "delivery",
      event: "failed",
    });
    if (!ev.ok) {
      console.error("[stripe/webhook] failed to record email event (failed)", {
        lead_id: leadId,
        status: ev.status,
        error: ev.error,
      });
    }
    return;
  }

  const ev = await insertApaEmailEvent({
    leadId,
    emailId: "delivery",
    event: "sent",
  });
  if (!ev.ok) {
    console.error("[stripe/webhook] failed to record email event (sent)", {
      lead_id: leadId,
      status: ev.status,
      error: ev.error,
      resend_id: send.id,
    });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    console.error("[stripe/webhook] failed to read body", err);
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const signature = req.headers.get("stripe-signature");
  const verified = verifyStripeSignature(rawBody, signature, secret);
  if (!verified.ok) {
    console.warn("[stripe/webhook] signature verification failed", {
      reason: verified.reason,
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch (err) {
    console.error("[stripe/webhook] invalid JSON body", err);
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await handleCheckoutCompleted(event.data.object as unknown as CheckoutSession);
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as unknown as CheckoutSession;
      console.warn("[stripe/webhook] checkout session expired", {
        session_id: session.id,
        lead_id: session.client_reference_id,
      });
    } else {
      console.warn("[stripe/webhook] ignoring unhandled event type", {
        event_id: event.id,
        type: event.type,
      });
    }
  } catch (err) {
    console.error("[stripe/webhook] handler threw", {
      event_id: event.id,
      type: event.type,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
