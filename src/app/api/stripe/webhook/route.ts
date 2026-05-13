import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  findLeadIdByStripeSessionId,
  insertApaEmailEvent,
  markApaLeadBundleUpgraded,
  markApaLeadCheckoutStatus,
  markApaLeadPaid,
} from "@/lib/wc-admin-supabase";
import { sendEmail } from "@/lib/resend";
import {
  getKitConfig,
  isKitSlug,
  KIT_CONFIG,
  type KitConfig,
  type KitSlug,
} from "@/lib/kit-config";

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

type PaymentIntent = {
  id: string;
  metadata: Record<string, string> | null;
  last_payment_error: { code?: string; message?: string; type?: string } | null;
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

function singleKitDeliveryHtml(kit: KitConfig, pdfUrl: string): string {
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

function singleKitDeliveryText(kit: KitConfig, pdfUrl: string): string {
  return `You bought ${kit.fullName}. It's attached.

${kit.blurb}

Read it cover to cover. Try one thing from it next time you sit down at your desk. The first clean run is the day this stops feeling theoretical.

If the PDF doesn't open, the file is here: ${pdfUrl}

If you want the live system around the kits — the brain pattern, the community, the operators trading patterns weekly — that's at:

${SITE_ORIGIN}

— Chase`;
}

function pairKitDeliveryHtml(
  primary: KitConfig,
  bump: KitConfig,
  primaryUrl: string,
  bumpUrl: string,
): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px 16px;background:#0b0b0b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;">
<div style="max-width:560px;margin:0 auto;">
<p>You bought ${primary.fullName} and added ${bump.fullName} at checkout. Both are attached.</p>
<p><strong>${primary.fullName}</strong> — <a href="${primaryUrl}" style="color:#6ee7b7;">download direct</a></p>
<p><strong>${bump.fullName}</strong> — <a href="${bumpUrl}" style="color:#6ee7b7;">download direct</a></p>
<p>Pick one and read it cover to cover this week. The kits compound, but one good read beats two half-skims.</p>
<p>The live system around the kits — the brain pattern, the community, the operators trading patterns weekly — is at <a href="${SITE_ORIGIN}" style="color:#6ee7b7;">aipocketagency.com</a>.</p>
<p style="margin-top:32px;">&mdash; Chase</p>
</div>
</body></html>`;
}

function pairKitDeliveryText(
  primary: KitConfig,
  bump: KitConfig,
  primaryUrl: string,
  bumpUrl: string,
): string {
  return `You bought ${primary.fullName} and added ${bump.fullName} at checkout. Both are attached.

${primary.fullName} — ${primaryUrl}
${bump.fullName} — ${bumpUrl}

Pick one and read it cover to cover this week. The kits compound, but one good read beats two half-skims.

The live system around the kits — the brain pattern, the community, the operators trading patterns weekly — is at ${SITE_ORIGIN}.

— Chase`;
}

function bundleDeliveryHtml(kits: KitConfig[]): string {
  const lines = kits
    .map(
      (k) =>
        `<p><strong>${k.fullName}</strong> — <a href="${SITE_ORIGIN}${k.pdfPath}" style="color:#6ee7b7;">download direct</a></p>`,
    )
    .join("");
  return `<!doctype html>
<html><body style="margin:0;padding:24px 16px;background:#0b0b0b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;">
<div style="max-width:560px;margin:0 auto;">
<p>You took the bundle. All five APA kits are attached.</p>
${lines}
<p>The order matters less than picking one and shipping a lane this week. The Dispatch Playbook is the foundation — start there if you don't know where to start.</p>
<p>The live system around the kits — three calls a week, the brain pattern, the operators trading patterns weekly — is at <a href="${SITE_ORIGIN}/skool-invite" style="color:#6ee7b7;">aipocketagency.com</a>.</p>
<p style="margin-top:32px;">&mdash; Chase</p>
</div>
</body></html>`;
}

function bundleDeliveryText(kits: KitConfig[]): string {
  const lines = kits
    .map((k) => `${k.fullName} — ${SITE_ORIGIN}${k.pdfPath}`)
    .join("\n");
  return `You took the bundle. All five APA kits are attached.

${lines}

The order matters less than picking one and shipping a lane this week. The Dispatch Playbook is the foundation — start there if you don't know where to start.

The live system around the kits — three calls a week, the brain pattern, the operators trading patterns weekly — is at ${SITE_ORIGIN}.

— Chase`;
}

function resolveKitFromSession(session: CheckoutSession): KitConfig | null {
  const candidate = session.metadata?.kit_slug ?? session.metadata?.source;
  if (!candidate || !isKitSlug(candidate)) return null;
  return getKitConfig(candidate);
}

function resolveBumpKitFromSession(session: CheckoutSession): KitConfig | null {
  const candidate = session.metadata?.bump_kit_slug;
  if (!candidate || !isKitSlug(candidate)) return null;
  return getKitConfig(candidate);
}

async function deliverPrimary(
  session: CheckoutSession,
  leadId: string,
  email: string,
): Promise<void> {
  const kit = resolveKitFromSession(session);
  if (!kit) {
    console.error("[stripe/webhook] cannot resolve kit from session metadata; skipping delivery", {
      lead_id: leadId,
      session_id: session.id,
      metadata: session.metadata,
    });
    return;
  }
  const bumpKit = resolveBumpKitFromSession(session);

  // Mark paid + capture bumped_kit_slug in one PATCH so wc-admin can filter.
  const paid = await markApaLeadPaid({
    leadId,
    stripeCustomerId: session.customer,
    stripePaymentIntentId: session.payment_intent,
    bumpedKitSlug: bumpKit?.slug ?? null,
  });
  if (!paid.ok) {
    console.error("[stripe/webhook] failed to mark lead paid", {
      lead_id: leadId,
      session_id: session.id,
      status: paid.status,
      error: paid.error,
    });
  }

  const primaryUrl = `${SITE_ORIGIN}${kit.pdfPath}`;
  const primaryFilename = kit.pdfPath.replace(/^\//, "");
  const attachments: Array<{ filename: string; path: string }> = [
    { filename: primaryFilename, path: primaryUrl },
  ];
  let subject = kit.deliverySubject;
  let html = singleKitDeliveryHtml(kit, primaryUrl);
  let text = singleKitDeliveryText(kit, primaryUrl);
  if (bumpKit) {
    const bumpUrl = `${SITE_ORIGIN}${bumpKit.pdfPath}`;
    const bumpFilename = bumpKit.pdfPath.replace(/^\//, "");
    attachments.push({ filename: bumpFilename, path: bumpUrl });
    subject = `${kit.deliverySubject} (+ ${bumpKit.shortName})`;
    html = pairKitDeliveryHtml(kit, bumpKit, primaryUrl, bumpUrl);
    text = pairKitDeliveryText(kit, bumpKit, primaryUrl, bumpUrl);
  }

  const send = await sendEmail({
    from: FROM,
    to: email,
    subject,
    html,
    text,
    attachments,
  });
  if (!send.ok) {
    console.error("[stripe/webhook] Resend send failed (primary)", {
      lead_id: leadId,
      session_id: session.id,
      kit_source: kit.slug,
      bump_source: bumpKit?.slug ?? null,
      status: send.status,
      error: send.error,
    });
    return;
  }

  const ev = await insertApaEmailEvent({
    leadId,
    emailId: bumpKit
      ? `delivery:${kit.slug}+${bumpKit.slug}`
      : `delivery:${kit.slug}`,
    event: "sent",
  });
  if (!ev.ok) {
    console.error("[stripe/webhook] failed to record email event (primary)", {
      lead_id: leadId,
      kit_source: kit.slug,
      status: ev.status,
      error: ev.error,
      resend_id: send.id,
    });
  }
}

async function deliverBundle(
  session: CheckoutSession,
  leadId: string,
  email: string,
): Promise<void> {
  // The bundle delivery sends ALL 5 kits as attachments. In the inline-funnel
  // pattern, the bundle Stripe session is the buyer's FIRST (and only) paid
  // charge — so we flip status='paid' here as well as stamping the bundle
  // columns. Both PATCHes are required: the drip cron filters on status,
  // and wc-admin filters on bundle_upgraded.
  const paid = await markApaLeadPaid({
    leadId,
    stripeCustomerId: session.customer,
    stripePaymentIntentId: session.payment_intent,
    bumpedKitSlug: null,
  });
  if (!paid.ok) {
    console.error("[stripe/webhook] failed to mark bundle lead paid", {
      lead_id: leadId,
      session_id: session.id,
      status: paid.status,
      error: paid.error,
    });
  }
  const mark = await markApaLeadBundleUpgraded({
    leadId,
    bundleSessionId: session.id,
    bundlePaymentIntentId: session.payment_intent,
  });
  if (!mark.ok) {
    console.error("[stripe/webhook] failed to mark bundle upgrade", {
      lead_id: leadId,
      session_id: session.id,
      status: mark.status,
      error: mark.error,
    });
  }

  const kits = (Object.values(KIT_CONFIG) as KitConfig[]).sort(
    (a, b) => kitOrder(a.slug) - kitOrder(b.slug),
  );
  const attachments = kits.map((k) => ({
    filename: k.pdfPath.replace(/^\//, ""),
    path: `${SITE_ORIGIN}${k.pdfPath}`,
  }));

  const send = await sendEmail({
    from: FROM,
    to: email,
    subject: "Your APA bundle — all 5 kits attached",
    html: bundleDeliveryHtml(kits),
    text: bundleDeliveryText(kits),
    attachments,
  });
  if (!send.ok) {
    console.error("[stripe/webhook] Resend send failed (bundle)", {
      lead_id: leadId,
      session_id: session.id,
      status: send.status,
      error: send.error,
    });
    return;
  }

  const ev = await insertApaEmailEvent({
    leadId,
    emailId: `delivery:bundle`,
    event: "sent",
  });
  if (!ev.ok) {
    console.error("[stripe/webhook] failed to record email event (bundle)", {
      lead_id: leadId,
      status: ev.status,
      error: ev.error,
      resend_id: send.id,
    });
  }
}

/** Stable ordering for the bundle email — Dispatch first, then the rest. */
function kitOrder(slug: KitSlug): number {
  const order: Record<KitSlug, number> = {
    "dispatch-playbook": 1,
    "dev-team-document-set": 2,
    "claude-md-template-library": 3,
    "discovery-to-mvp-prompt-pack": 4,
    "wire-brain-to-stack-guide": 5,
  };
  return order[slug];
}

async function resolveLeadIdFromSession(
  session: CheckoutSession,
): Promise<string | null> {
  if (session.client_reference_id) return session.client_reference_id;
  const fromMetadata = session.metadata?.lead_id;
  if (fromMetadata) return fromMetadata;
  const fallback = await findLeadIdByStripeSessionId(session.id);
  if (!fallback.ok) {
    console.error("[stripe/webhook] findLeadIdByStripeSessionId failed", {
      session_id: session.id,
      status: fallback.status,
      error: fallback.error,
    });
    return null;
  }
  return fallback.leadId;
}

async function handleCheckoutExpired(session: CheckoutSession): Promise<void> {
  const leadId = await resolveLeadIdFromSession(session);
  if (!leadId) {
    console.warn("[stripe/webhook] checkout.session.expired: no matching lead", {
      session_id: session.id,
      funnel_stage: session.metadata?.funnel_stage ?? null,
    });
    return;
  }
  const mark = await markApaLeadCheckoutStatus({
    leadId,
    status: "abandoned",
    stripeSessionId: session.id,
    expiredAt: new Date().toISOString(),
  });
  if (!mark.ok) {
    console.error("[stripe/webhook] failed to mark lead abandoned", {
      lead_id: leadId,
      session_id: session.id,
      status: mark.status,
      error: mark.error,
    });
    return;
  }
  console.info("[stripe/webhook] marked lead abandoned", {
    lead_id: leadId,
    session_id: session.id,
  });
}

async function handlePaymentFailed(intent: PaymentIntent): Promise<void> {
  const leadId = intent.metadata?.lead_id ?? null;
  if (!leadId) {
    console.warn("[stripe/webhook] payment_intent.payment_failed missing lead_id metadata", {
      intent_id: intent.id,
    });
    return;
  }
  const mark = await markApaLeadCheckoutStatus({
    leadId,
    status: "payment_failed",
  });
  if (!mark.ok) {
    console.error("[stripe/webhook] failed to mark lead payment_failed", {
      lead_id: leadId,
      intent_id: intent.id,
      status: mark.status,
      error: mark.error,
    });
    return;
  }
  console.info("[stripe/webhook] marked lead payment_failed", {
    lead_id: leadId,
    intent_id: intent.id,
    last_payment_error_code: intent.last_payment_error?.code ?? null,
  });
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
  if (!email) {
    console.error("[stripe/webhook] missing customer_email; skipping delivery", {
      lead_id: leadId,
      session_id: session.id,
    });
    return;
  }

  const stage = session.metadata?.funnel_stage ?? "primary";
  if (stage === "bundle_upgrade") {
    await deliverBundle(session, leadId, email);
    return;
  }
  // Default / 'primary' branch: original kit + optional bump.
  await deliverPrimary(session, leadId, email);
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
      await handleCheckoutExpired(event.data.object as unknown as CheckoutSession);
    } else if (event.type === "payment_intent.payment_failed") {
      await handlePaymentFailed(event.data.object as unknown as PaymentIntent);
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
