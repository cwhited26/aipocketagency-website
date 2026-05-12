import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  insertApaEmailEvent,
  markApaLeadPaid,
} from "@/lib/wc-admin-supabase";
import { sendEmail } from "@/lib/resend";
import { getKitConfig, isKitSlug, type KitConfig } from "@/lib/kit-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const SITE_ORIGIN = "https://aipocketagency.com";
const FROM = "Chase Whited <chase@aipocketagency.com>";

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

function deliveryEmailHtml(kit: KitConfig, pdfUrl: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px 16px;background:#0b0b0b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;">
<div style="max-width:560px;margin:0 auto;">
<p>You bought ${kit.fullName}. It's attached.</p>
<p>${kit.blurb}</p>
<p>Read it cover to cover. Try one thing from it next time you sit down at your desk. The first clean run is the day this stops feeling theoretical.</p>
<p>If the PDF doesn't open, <a href="${pdfUrl}" style="color:#6ee7b7;">download it directly here</a>.</p>
<p>If you want the live system around the kits — the brain pattern, the community, the operators trading patterns weekly — that's at:</p>
<p><a href="${SITE_ORIGIN}" style="color:#6ee7b7;">aipocketagency.com</a></p>
<p style="margin-top:32px;">&mdash; Chase</p>
</div>
</body></html>`;
}

function deliveryEmailText(kit: KitConfig, pdfUrl: string): string {
  return `You bought ${kit.fullName}. It's attached.

${kit.blurb}

Read it cover to cover. Try one thing from it next time you sit down at your desk. The first clean run is the day this stops feeling theoretical.

If the PDF doesn't open, the file is here: ${pdfUrl}

If you want the live system around the kits — the brain pattern, the community, the operators trading patterns weekly — that's at:

${SITE_ORIGIN}

— Chase`;
}

function resolveKitFromSession(session: CheckoutSession): KitConfig | null {
  const candidate = session.metadata?.kit_slug ?? session.metadata?.source;
  if (!candidate) return null;
  if (!isKitSlug(candidate)) return null;
  return getKitConfig(candidate);
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

  // Pipeline playbook: branch on lead.source (carried via session metadata) to
  // pick which PDF to attach. Fail loud rather than ship the wrong file.
  const kit = resolveKitFromSession(session);
  if (!kit) {
    console.error("[stripe/webhook] cannot resolve kit from session metadata; skipping delivery", {
      lead_id: leadId,
      session_id: session.id,
      metadata: session.metadata,
    });
    return;
  }

  const pdfUrl = `${SITE_ORIGIN}${kit.pdfPath}`;
  const pdfFilename = kit.pdfPath.replace(/^\//, "");

  const send = await sendEmail({
    from: FROM,
    to: email,
    subject: kit.deliverySubject,
    html: deliveryEmailHtml(kit, pdfUrl),
    text: deliveryEmailText(kit, pdfUrl),
    attachments: [{ filename: pdfFilename, path: pdfUrl }],
  });

  if (!send.ok) {
    console.error("[stripe/webhook] Resend send failed", {
      lead_id: leadId,
      session_id: session.id,
      kit_source: kit.slug,
      status: send.status,
      error: send.error,
    });
    return;
  }

  const ev = await insertApaEmailEvent({
    leadId,
    emailId: `delivery:${kit.slug}`,
    event: "sent",
  });
  if (!ev.ok) {
    console.error("[stripe/webhook] failed to record email event (sent)", {
      lead_id: leadId,
      kit_source: kit.slug,
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
