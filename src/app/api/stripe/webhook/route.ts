import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  findLeadIdByStripeSessionId,
  insertApaEmailEvent,
  markApaLeadBundleUpgraded,
  markApaLeadCheckoutStatus,
  markApaLeadPaid,
} from "@/lib/wc-admin-supabase";
import {
  fetchPocketAgentByCustomerId,
  fetchPocketAgentBySubscriptionId,
  insertPocketAgentAddonPurchase,
  markPocketAgentActive,
  markPocketAgentCanceled,
  markPocketAgentTier,
  markPocketAgentTrialEndNotified,
  markWelcomeEmailSent,
  setPocketAgentAddonByCustomer,
  upsertPocketAgentTrial,
} from "@/lib/pocket-agent-supabase";
import {
  getAddonMeta,
  isAddonCheckoutKind,
  type AddonCheckoutKind,
} from "@/lib/pocket-agent-addons";
import { getAddonFromStripePriceId, resolveProvisionTier } from "@/lib/personas/tier-caps";
import {
  applyPocketAgentTierFromSubscription,
  extractPriceIds,
  type StripeSubscription,
} from "@/lib/pocket-agent-webhook-tier";
import {
  enqueueDiyKit,
  enqueueDwy,
  enqueueOnboarding,
  enqueuePilot,
} from "@/lib/emails/enqueue";
import { cancelPendingForOwnerSequences, enqueueEmail } from "@/lib/emails/queue";
import { renderBySlug } from "@/lib/emails/registry";
import { EMAIL_FROM } from "@/lib/emails/render";
import { CANCELLABLE_SEQUENCES } from "@/lib/emails/sequences";
import { sendEmail } from "@/lib/resend";
import {
  getKitConfig,
  isKitSlug,
  KIT_CONFIG,
  type KitConfig,
  type KitSlug,
} from "@/lib/kit-config";
import { ensureLaunchKitSeeded, seedStarterSkillsForSubscription } from "@/lib/launch-kit/seed";
import { createSprintFromCheckout } from "@/lib/setup-sprint/sprints";
import { inviteEmailBody } from "@/lib/setup-sprint/calendar-invite-template";
import { signDiyKitDownload } from "@/lib/diy-kit/download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const SITE_ORIGIN = "https://aipocketagent.com";
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
  subscription: string | null;
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
<p><a href="${SITE_ORIGIN}" style="color:#6ee7b7;">aipocketagent.com</a></p>
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
<p>The live system around the kits — the brain pattern, the community, the operators trading patterns weekly — is at <a href="${SITE_ORIGIN}" style="color:#6ee7b7;">aipocketagent.com</a>.</p>
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
<p>The live system around the kits — three calls a week, the brain pattern, the operators trading patterns weekly — is at <a href="${SITE_ORIGIN}/skool-invite" style="color:#6ee7b7;">aipocketagent.com</a>.</p>
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

function welcomeEmailHtml(name: string | null): string {
  const greeting = name ? `Hey ${name} —` : "Hey —";
  return `<!doctype html>
<html><body style="margin:0;padding:24px 16px;background:#0b0b0b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;">
<div style="max-width:560px;margin:0 auto;">
<p>${greeting}</p>
<p>Your trial just started. Here's what Pocket Agent is: your AI partner that reads your business context, drafts work in your voice, and queues changes for your approval before anything gets committed.</p>
<p><strong>Three things to do right now:</strong></p>
<p><strong>1. Connect your brain repo.</strong> Your brain is a GitHub repo where context lives — decisions, voice files, client details. Without it, the agent can't do anything. <a href="${SITE_ORIGIN}/app/onboarding" style="color:#6ee7b7;">Set it up here.</a></p>
<p><strong>2. Add your Anthropic API key in Settings.</strong> You run on your own key — you control the bill, your data stays yours. <a href="${SITE_ORIGIN}/app/settings" style="color:#6ee7b7;">Go to Settings.</a></p>
<p><strong>3. Install as a home screen app.</strong><br>
iOS: open Safari → tap Share → Add to Home Screen<br>
Android: open Chrome → three-dot menu → Add to Home Screen<br>
Desktop: look for the install icon in your browser's address bar</p>
<p><strong>Capture from your phone:</strong> The iOS Shortcut lets you send voice notes, screenshots, and links straight into your brain inbox from anywhere. <a href="${SITE_ORIGIN}/app/share-setup" style="color:#6ee7b7;">Set it up here.</a></p>
<p><strong>Routines:</strong> Your agent can run on a schedule — daily brief, follow-up sweep, weekly digest. <a href="${SITE_ORIGIN}/app/routines" style="color:#6ee7b7;">Toggle them on here.</a></p>
<p><a href="${SITE_ORIGIN}/app" style="color:#6ee7b7;">Open the app →</a></p>
<p style="margin-top:32px;">&mdash; Chase</p>
</div>
</body></html>`;
}

function welcomeEmailText(name: string | null): string {
  const greeting = name ? `Hey ${name} —` : "Hey —";
  return `${greeting}

Your trial just started. Here's what Pocket Agent is: your AI partner that reads your business context, drafts work in your voice, and queues changes for your approval before anything gets committed.

Three things to do right now:

1. Connect your brain repo. Your brain is a GitHub repo where context lives — decisions, voice files, client details. Without it, the agent can't do anything.
${SITE_ORIGIN}/app/onboarding

2. Add your Anthropic API key in Settings. You run on your own key — you control the bill, your data stays yours.
${SITE_ORIGIN}/app/settings

3. Install as a home screen app.
   iOS: open Safari → tap Share → Add to Home Screen
   Android: open Chrome → three-dot menu → Add to Home Screen
   Desktop: look for the install icon in your browser's address bar

Capture from your phone: The iOS Shortcut lets you send voice notes, screenshots, and links straight into your brain inbox from anywhere.
${SITE_ORIGIN}/app/share-setup

Routines: Your agent can run on a schedule — daily brief, follow-up sweep, weekly digest.
${SITE_ORIGIN}/app/routines

Open the app: ${SITE_ORIGIN}/app

— Chase`;
}

// ─── Pocket Agent subscription types ────────────────────────────────────────

type StripeInvoice = {
  id: string;
  customer: string | null;
  customer_email: string | null;
  subscription: string | null;
  status: string | null;
  amount_paid: number;
  billing_reason: string | null;
};

// ─── Pocket Agent subscription handlers ─────────────────────────────────────

async function handlePocketAgentCheckoutCompleted(
  session: CheckoutSession,
): Promise<void> {
  const email = session.metadata?.email ?? session.customer_email;
  const name = session.metadata?.name ?? null;
  // client_reference_id carries user_id when the buyer was already signed in;
  // metadata.user_id is the same value written by the checkout route as a fallback.
  const userId = session.client_reference_id ?? session.metadata?.user_id ?? null;

  if (!email) {
    console.error("[stripe/webhook] pocket_agent checkout.session.completed: missing email", {
      session_id: session.id,
    });
    return;
  }
  if (!session.customer) {
    console.error("[stripe/webhook] pocket_agent checkout.session.completed: missing customer", {
      session_id: session.id,
    });
    return;
  }
  if (!session.subscription) {
    console.error(
      "[stripe/webhook] pocket_agent checkout.session.completed: missing subscription id",
      { session_id: session.id },
    );
    return;
  }

  // Write the trial row immediately from checkout data so it exists in the DB
  // before customer.subscription.created arrives. trial_end is approximated
  // here; the subsequent customer.subscription.created upsert overwrites it
  // with the accurate timestamp from the Stripe subscription object.
  const now = new Date();
  const approxTrialEnd = new Date(now);
  approxTrialEnd.setDate(approxTrialEnd.getDate() + 14);

  const upsert = await upsertPocketAgentTrial({
    email,
    name,
    userId,
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
    stripeSessionId: session.id,
    trialStartedAt: now.toISOString(),
    trialEndsAt: approxTrialEnd.toISOString(),
  });
  if (!upsert.ok) {
    console.error("[stripe/webhook] pocket_agent checkout.session.completed: upsert failed", {
      session_id: session.id,
      subscription_id: session.subscription,
      status: upsert.status,
      error: upsert.error,
    });
  } else {
    console.info("[stripe/webhook] pocket_agent trial row written from checkout", {
      session_id: session.id,
      subscription_id: session.subscription,
      email,
    });
  }

  // The Launch Kit ships with every paid subscription — auto-install the 5 starter Workflow Vault
  // recipes (PA-LAUNCHKIT-IMPL-3). Idempotent; needs the owner's user id.
  if (userId) {
    const seeded = await ensureLaunchKitSeeded(userId);
    if (!seeded.ok) {
      console.error("[stripe/webhook] pocket_agent: launch kit seed failed", {
        session_id: session.id,
        error: seeded.error,
      });
    }
  }

  // The $47 Workflow Vault order-bump (PA-VAULT-2): unlock all 25 recipes by ledgering a
  // workflow_vault purchase row. The session id keys idempotency, so retries don't double-write.
  if (session.metadata?.bump_workflow_vault === "true") {
    const unlock = await insertPocketAgentAddonPurchase({
      userId,
      email,
      kind: "workflow_vault",
      stripeSessionId: session.id,
      stripeCustomerId: session.customer,
      stripePaymentIntentId: session.payment_intent,
      amountCents: 4_700,
    });
    if (!unlock.ok) {
      console.error("[stripe/webhook] pocket_agent: workflow_vault unlock ledger failed", {
        session_id: session.id,
        status: unlock.status,
        error: unlock.error,
      });
    } else {
      console.info("[stripe/webhook] pocket_agent: workflow vault unlocked via order bump", {
        session_id: session.id,
        email,
      });
    }
  }
}

async function handlePocketAgentSubscriptionCreated(
  sub: StripeSubscription,
): Promise<void> {
  const email = sub.metadata?.email ?? null;
  const name = sub.metadata?.name ?? null;
  const userId = sub.metadata?.user_id ?? null;
  if (!email) {
    console.error("[stripe/webhook] pocket_agent subscription.created missing email metadata", {
      subscription_id: sub.id,
      customer: sub.customer,
    });
    return;
  }
  if (!sub.customer) {
    console.error("[stripe/webhook] pocket_agent subscription.created missing customer", {
      subscription_id: sub.id,
    });
    return;
  }

  const trialStartedAt = sub.trial_start
    ? new Date(sub.trial_start * 1000).toISOString()
    : new Date().toISOString();
  const trialEndsAt = sub.trial_end
    ? new Date(sub.trial_end * 1000).toISOString()
    : null;

  const upsert = await upsertPocketAgentTrial({
    email,
    name,
    userId,
    stripeCustomerId: sub.customer,
    stripeSubscriptionId: sub.id,
    stripeSessionId: null,
    trialStartedAt,
    trialEndsAt,
  });
  if (!upsert.ok) {
    console.error("[stripe/webhook] failed to upsert pocket_agent trial", {
      subscription_id: sub.id,
      status: upsert.status,
      error: upsert.error,
    });
    return;
  }

  console.info("[stripe/webhook] pocket_agent trial started", {
    subscription_id: sub.id,
    email,
    trial_ends_at: trialEndsAt,
  });

  // Check if welcome email was already sent (idempotency guard against webhook retries).
  const existingRow = await fetchPocketAgentBySubscriptionId(sub.id);
  if (existingRow.ok && existingRow.row?.welcome_email_sent_at) {
    console.info("[stripe/webhook] pocket_agent welcome email already sent, skipping", {
      subscription_id: sub.id,
    });
    return;
  }

  // GTM Phase 3: enqueue the universal 12-email onboarding + the plan-specific welcome (immediate),
  // picked from the subscription's tier. The queue owns Day-0 → Day-14. If the enqueue fails (e.g. the
  // 076 queue table isn't applied yet) we fall back to the legacy single "You're in." welcome so the
  // buyer is never left without a receipt. welcome_email_sent_at is the idempotency guard either way.
  const tier =
    resolveProvisionTier({ priceIds: extractPriceIds(sub), metadataTier: sub.metadata?.tier }) ??
    "starter";
  const enqueued = await enqueueOnboarding({ ownerId: userId, email, firstName: name }, tier);
  if (!enqueued.ok) {
    console.error("[stripe/webhook] pocket_agent onboarding enqueue failed; sending legacy welcome", {
      subscription_id: sub.id,
      error: enqueued.error,
    });
    const send = await sendEmail({
      from: FROM,
      to: email,
      subject: "You're in.",
      html: welcomeEmailHtml(name),
      text: welcomeEmailText(name),
    });
    if (!send.ok) {
      console.error("[stripe/webhook] failed to send pocket_agent welcome email", {
        subscription_id: sub.id,
        email,
        status: send.status,
        error: send.error,
      });
      return;
    }
  } else {
    console.info("[stripe/webhook] pocket_agent onboarding sequence enqueued", {
      subscription_id: sub.id,
      email,
      tier,
      count: enqueued.count,
    });
  }

  const mark = await markWelcomeEmailSent(sub.id);
  if (!mark.ok) {
    console.error("[stripe/webhook] failed to mark pocket_agent welcome_email_sent", {
      subscription_id: sub.id,
      status: mark.status,
      error: mark.error,
    });
  }
}

async function handlePocketAgentTrialWillEnd(
  sub: StripeSubscription,
): Promise<void> {
  const email = sub.metadata?.email ?? null;
  const name = sub.metadata?.name ?? null;
  if (!email) {
    console.warn("[stripe/webhook] pocket_agent trial_will_end missing email metadata", {
      subscription_id: sub.id,
    });
    return;
  }

  const trialEndDate = sub.trial_end
    ? new Date(sub.trial_end * 1000).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "in 3 days";

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px 16px;background:#0b0b0b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;">
<div style="max-width:560px;margin:0 auto;">
<p>Hey${name ? ` ${name}` : ""} —</p>
<p>Your Pocket Agent free trial ends on <strong>${trialEndDate}</strong>. After that, your card will be charged $37/mo.</p>
<p>If you want to cancel before then, you can do it any time from your billing portal. Just reply to this email and I'll send you the link.</p>
<p>If you're still getting set up, the brain template is at <a href="https://aipocketagent.com" style="color:#6ee7b7;">aipocketagent.com</a> — everything you need is there.</p>
<p style="margin-top:32px;">&mdash; Chase</p>
</div>
</body></html>`;

  const text = `Hey${name ? ` ${name}` : ""} —

Your Pocket Agent free trial ends on ${trialEndDate}. After that, your card will be charged $37/mo.

If you want to cancel before then, you can do it any time from your billing portal. Just reply to this email and I'll send you the link.

If you're still getting set up, the brain template is at https://aipocketagent.com

— Chase`;

  const send = await sendEmail({
    from: FROM,
    to: email,
    subject: `Your Pocket Agent trial ends ${trialEndDate}`,
    html,
    text,
  });
  if (!send.ok) {
    console.error("[stripe/webhook] failed to send pocket_agent trial_will_end email", {
      subscription_id: sub.id,
      email,
      status: send.status,
      error: send.error,
    });
    return;
  }

  const mark = await markPocketAgentTrialEndNotified(sub.id);
  if (!mark.ok) {
    console.error("[stripe/webhook] failed to mark pocket_agent trial_end_notified", {
      subscription_id: sub.id,
      status: mark.status,
      error: mark.error,
    });
  }
  console.info("[stripe/webhook] pocket_agent trial_will_end email sent", {
    subscription_id: sub.id,
    email,
  });
}

async function handlePocketAgentInvoicePaid(invoice: StripeInvoice): Promise<void> {
  if (!invoice.subscription) {
    return;
  }

  const lookup = await fetchPocketAgentBySubscriptionId(invoice.subscription);
  if (!lookup.ok) {
    console.error("[stripe/webhook] pocket_agent invoice.payment_succeeded: lookup failed", {
      invoice_id: invoice.id,
      subscription_id: invoice.subscription,
      status: lookup.status,
      error: lookup.error,
    });
    return;
  }
  if (!lookup.row) {
    // Not a Pocket Agent subscription — ignore silently.
    return;
  }

  const mark = await markPocketAgentActive(invoice.subscription);
  if (!mark.ok) {
    console.error("[stripe/webhook] failed to mark pocket_agent active", {
      invoice_id: invoice.id,
      subscription_id: invoice.subscription,
      status: mark.status,
      error: mark.error,
    });
    return;
  }
  console.info("[stripe/webhook] pocket_agent marked active", {
    invoice_id: invoice.id,
    subscription_id: invoice.subscription,
    email: lookup.row.email,
  });
}

async function handlePocketAgentSubscriptionDeleted(
  sub: StripeSubscription,
): Promise<void> {
  const lookup = await fetchPocketAgentBySubscriptionId(sub.id);
  if (!lookup.ok) {
    console.error("[stripe/webhook] pocket_agent subscription.deleted: lookup failed", {
      subscription_id: sub.id,
      status: lookup.status,
      error: lookup.error,
    });
    return;
  }
  if (!lookup.row) {
    return;
  }

  const mark = await markPocketAgentCanceled(sub.id);
  if (!mark.ok) {
    console.error("[stripe/webhook] failed to mark pocket_agent canceled", {
      subscription_id: sub.id,
      status: mark.status,
      error: mark.error,
    });
    return;
  }

  // Clear the SMB tier on cancel so getCurrentTier falls back to the status-based
  // mapping ('starter') instead of returning the now-defunct paid tier. Best-effort.
  const cleared = await markPocketAgentTier(sub.id, null);
  if (!cleared.ok) {
    console.error("[stripe/webhook] failed to clear pocket_agent tier on cancel", {
      subscription_id: sub.id,
      status: cleared.status,
      error: cleared.error,
    });
  }

  // If the canceled subscription was a dev add-on, clear its flag for the customer.
  if (sub.customer) {
    for (const priceId of extractPriceIds(sub)) {
      const addon = getAddonFromStripePriceId(priceId);
      if (!addon) continue;
      const unset = await setPocketAgentAddonByCustomer({
        stripeCustomerId: sub.customer,
        addon,
        enabled: false,
      });
      if (!unset.ok) {
        console.error("[stripe/webhook] failed to clear pocket_agent add-on on cancel", {
          subscription_id: sub.id,
          customer: sub.customer,
          addon,
          status: unset.status,
          error: unset.error,
        });
      }
    }
  }

  console.info("[stripe/webhook] pocket_agent marked canceled", {
    subscription_id: sub.id,
    email: lookup.row.email,
  });

  // GTM Phase 3: clear any pending onboarding/pilot emails for this owner, then send the cancellation
  // confirmation (transactional). The confirmation is enqueued (drains within 5 min); on enqueue failure
  // it's sent inline so the customer always gets the receipt.
  const ownerId = lookup.row.user_id;
  const cancelEmail = lookup.row.email;
  const cancelName = lookup.row.name;
  if (ownerId) {
    const cleared = await cancelPendingForOwnerSequences(
      ownerId,
      CANCELLABLE_SEQUENCES,
      "sequence_cancelled",
    );
    if (!cleared.ok) {
      console.error("[stripe/webhook] failed to cancel pending sequences on churn", {
        subscription_id: sub.id,
        error: cleared.error,
      });
    }
  }
  const confProps = { email: cancelEmail, firstName: cancelName };
  const conf = await enqueueEmail({
    ownerId,
    email: cancelEmail,
    templateSlug: "cancellation.confirmation",
    templateProps: confProps,
    sequenceSlug: null,
    sendAt: new Date().toISOString(),
  });
  if (!conf.ok) {
    const rendered = renderBySlug("cancellation.confirmation", confProps);
    if (rendered) {
      const send = await sendEmail({
        from: EMAIL_FROM,
        to: cancelEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      if (!send.ok) {
        console.error("[stripe/webhook] cancellation confirmation send failed", {
          subscription_id: sub.id,
          status: send.status,
          error: send.error,
        });
      }
    }
  }
}

// ─── Kit helpers ─────────────────────────────────────────────────────────────

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

// ─── Funnel v1 one-time add-on handlers (PA-FUNNEL) ──────────────────────────

function setupConfirmationHtml(name: string | null): string {
  const greeting = name ? `Hey ${name} —` : "Hey —";
  return `<!doctype html>
<html><body style="margin:0;padding:24px 16px;background:#0b0b0b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;">
<div style="max-width:560px;margin:0 auto;">
<p>${greeting}</p>
<p>You added the Done-With-You Setup. That means I build your workspace for you instead of you setting it up yourself — your Business Brain from your real business, your Personas configured to your jobs, your first workflow running, and a call to hand you the keys.</p>
<p>Next step is the call. I'll email you a booking link and a short intake (your existing writing for voice, your customer list, your pricing, the one workflow you want first) so the call is spent building, not gathering.</p>
<p>If the setup call doesn't leave you with a workspace that's actually running your work, we keep working until it does. Reply to this email, no form.</p>
<p style="margin-top:32px;">&mdash; Chase</p>
</div>
</body></html>`;
}

function setupConfirmationText(name: string | null): string {
  const greeting = name ? `Hey ${name} —` : "Hey —";
  return `${greeting}

You added the Done-With-You Setup. That means I build your workspace for you instead of you setting it up yourself — your Business Brain from your real business, your Personas configured to your jobs, your first workflow running, and a call to hand you the keys.

Next step is the call. I'll email you a booking link and a short intake (your existing writing for voice, your customer list, your pricing, the one workflow you want first) so the call is spent building, not gathering.

If the setup call doesn't leave you with a workspace that's actually running your work, we keep working until it does. Reply to this email, no form.

— Chase`;
}

function pilotConfirmationHtml(name: string | null): string {
  const greeting = name ? `Hey ${name} —` : "Hey —";
  return `<!doctype html>
<html><body style="margin:0;padding:24px 16px;background:#0b0b0b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;">
<div style="max-width:560px;margin:0 auto;">
<p>${greeting}</p>
<p>Your 14-day Pilot just started. Here's what's in it: a Business Brain starter set up from your business, one Persona on the job that's burying you most, one real workflow running, and a Mission Control review where we walk you through reading the cockpit.</p>
<p>The $97 comes off your subscription if you upgrade inside the 14 days — so trying it first costs you nothing extra.</p>
<p><a href="${SITE_ORIGIN}/app" style="color:#6ee7b7;">Open your workspace →</a></p>
<p style="margin-top:32px;">&mdash; Chase</p>
</div>
</body></html>`;
}

function pilotConfirmationText(name: string | null): string {
  const greeting = name ? `Hey ${name} —` : "Hey —";
  return `${greeting}

Your 14-day Pilot just started. Here's what's in it: a Business Brain starter set up from your business, one Persona on the job that's burying you most, one real workflow running, and a Mission Control review where we walk you through reading the cockpit.

The $97 comes off your subscription if you upgrade inside the 14 days — so trying it first costs you nothing extra.

Open your workspace: ${SITE_ORIGIN}/app

— Chase`;
}

function vaultConfirmationHtml(name: string | null): string {
  const greeting = name ? `Hey ${name} —` : "Hey —";
  return `<!doctype html>
<html><body style="margin:0;padding:24px 16px;background:#0b0b0b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;">
<div style="max-width:560px;margin:0 auto;">
<p>${greeting}</p>
<p>Your AI Workflow Vault is unlocked — all 25 recipes are open on your account. Quote follow-ups, a dormant-lead sweep, your morning brief, content repurposing, lead research, and more.</p>
<p>Open the Vault, pick one, choose which Persona runs it, and it's working. Every recipe brings back a draft you approve before anything goes out.</p>
<p><a href="${SITE_ORIGIN}/app/apps/workflow-vault" style="color:#6ee7b7;">Open the Workflow Vault →</a></p>
<p style="margin-top:32px;">&mdash; Chase</p>
</div>
</body></html>`;
}

function vaultConfirmationText(name: string | null): string {
  const greeting = name ? `Hey ${name} —` : "Hey —";
  return `${greeting}

Your AI Workflow Vault is unlocked — all 25 recipes are open on your account. Quote follow-ups, a dormant-lead sweep, your morning brief, content repurposing, lead research, and more.

Open the Vault, pick one, choose which Persona runs it, and it's working. Every recipe brings back a draft you approve before anything goes out.

Open the Workflow Vault: ${SITE_ORIGIN}/app/apps/workflow-vault

— Chase`;
}

function diyKitDeliveryHtml(name: string | null, downloadUrl: string): string {
  const greeting = name ? `Hey ${name} —` : "Hey —";
  return `<!doctype html>
<html><body style="margin:0;padding:24px 16px;background:#0b0b0b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;">
<div style="max-width:560px;margin:0 auto;">
<p>${greeting}</p>
<p>Your AI Office DIY Setup Kit is ready. Inside: the Business Brain upload checklist, the Mission Control review, the 7-day setup plan, setup templates for your three starter Personas, 25 workflow prompts, and an import-ready file you drop into Pocket Agent when you sign up.</p>
<p><a href="${downloadUrl}" style="color:#6ee7b7;">Download your kit →</a></p>
<p>The link is good for 24 hours. If it expires, reply and I'll send a fresh one.</p>
<p>When you're ready for the live system around it, that's at <a href="${SITE_ORIGIN}" style="color:#6ee7b7;">aipocketagent.com</a>.</p>
<p style="margin-top:32px;">&mdash; Chase</p>
</div>
</body></html>`;
}

function diyKitDeliveryText(name: string | null, downloadUrl: string): string {
  const greeting = name ? `Hey ${name} —` : "Hey —";
  return `${greeting}

Your AI Office DIY Setup Kit is ready. Inside: the Business Brain upload checklist, the Mission Control review, the 7-day setup plan, setup templates for your three starter Personas, 25 workflow prompts, and an import-ready file you drop into Pocket Agent when you sign up.

Download your kit: ${downloadUrl}

The link is good for 24 hours. If it expires, reply and I'll send a fresh one.

When you're ready for the live system around it, that's at ${SITE_ORIGIN}.

— Chase`;
}

async function handlePocketAgentAddonCompleted(
  session: CheckoutSession,
): Promise<void> {
  const kindRaw = session.metadata?.addon_kind ?? null;
  if (!kindRaw || !isAddonCheckoutKind(kindRaw)) {
    console.error("[stripe/webhook] pocket_agent_addon: missing/unknown addon_kind", {
      session_id: session.id,
      addon_kind: kindRaw,
    });
    return;
  }
  const kind: AddonCheckoutKind = kindRaw;
  const meta = getAddonMeta(kind);
  const email = session.metadata?.email ?? session.customer_email ?? null;
  const userId = session.client_reference_id ?? session.metadata?.user_id ?? null;
  const name = session.metadata?.name ?? null;

  const ledger = await insertPocketAgentAddonPurchase({
    userId,
    email,
    kind,
    stripeSessionId: session.id,
    stripeCustomerId: session.customer,
    stripePaymentIntentId: session.payment_intent,
    amountCents: session.amount_total ?? meta.amountCents,
  });
  if (!ledger.ok) {
    console.error("[stripe/webhook] pocket_agent_addon: ledger insert failed", {
      session_id: session.id,
      kind,
      status: ledger.status,
      error: ledger.error,
    });
  }

  // A Done-With-You Setup purchase opens an operator-facing Setup Sprint (PA-SPRINT-2). Idempotent on
  // the session id, so webhook retries don't duplicate.
  if (kind === "setup_standard" || kind === "setup_premium") {
    const sprintTier = kind === "setup_premium" ? "premium" : "standard";
    const sprint = await createSprintFromCheckout({
      ownerId: userId,
      email,
      tier: sprintTier,
      stripeSessionId: session.id,
    });
    if (!sprint.ok) {
      console.error("[stripe/webhook] pocket_agent_addon: setup sprint create failed", {
        session_id: session.id,
        kind,
        status: sprint.status,
        error: sprint.error,
      });
    }
  }

  if (!email) {
    console.warn("[stripe/webhook] pocket_agent_addon: no email, skipping confirmation", {
      session_id: session.id,
      kind,
    });
    return;
  }

  // GTM Phase 3: enqueue the post-purchase sequence for this kind (Day-0 confirmation through the tail).
  // On success we return — the queue owns the confirmation. On failure (e.g. the 076 queue table isn't
  // applied yet) we fall through to the existing inline confirmation so the buyer still gets a receipt.
  // workflow_vault has no sequence and always uses the inline confirmation below.
  const who = { ownerId: userId, email, firstName: name };
  if (kind === "pilot") {
    const enq = await enqueuePilot(who);
    if (enq.ok) {
      console.info("[stripe/webhook] pocket_agent_addon: pilot sequence enqueued", {
        session_id: session.id,
        count: enq.count,
      });
      return;
    }
    console.error("[stripe/webhook] pilot enqueue failed; falling back to inline confirmation", {
      session_id: session.id,
      error: enq.error,
    });
  } else if (kind === "setup_standard" || kind === "setup_premium") {
    const enq = await enqueueDwy(who, kind === "setup_premium" ? "premium" : "standard");
    if (enq.ok) {
      console.info("[stripe/webhook] pocket_agent_addon: DWY sequence enqueued", {
        session_id: session.id,
        count: enq.count,
      });
      return;
    }
    console.error("[stripe/webhook] DWY enqueue failed; falling back to inline confirmation", {
      session_id: session.id,
      error: enq.error,
    });
  } else if (kind === "diy_setup_kit") {
    const signed = await signDiyKitDownload();
    const downloadUrl = signed.ok ? signed.url : `${SITE_ORIGIN}/app/apps/diy-kit`;
    const enq = await enqueueDiyKit(who, downloadUrl);
    if (enq.ok) {
      console.info("[stripe/webhook] pocket_agent_addon: DIY kit sequence enqueued", {
        session_id: session.id,
        count: enq.count,
      });
      return;
    }
    console.error("[stripe/webhook] DIY kit enqueue failed; falling back to inline confirmation", {
      session_id: session.id,
      error: enq.error,
    });
  }

  // Per-kind confirmation. Vault and DIY Kit have their own emails; setup/pilot keep the funnel copy.
  let subject: string;
  let html: string;
  let text: string;
  if (kind === "workflow_vault") {
    subject = "Your AI Workflow Vault is unlocked";
    html = vaultConfirmationHtml(name);
    text = vaultConfirmationText(name);
  } else if (kind === "diy_setup_kit") {
    const signed = await signDiyKitDownload();
    if (!signed.ok) {
      console.error("[stripe/webhook] pocket_agent_addon: diy kit signed URL failed", {
        session_id: session.id,
        status: signed.status,
        error: signed.error,
      });
    }
    const downloadUrl = signed.ok ? signed.url : `${SITE_ORIGIN}/app/apps/diy-kit`;
    subject = "Your AI Office DIY Setup Kit — download inside";
    html = diyKitDeliveryHtml(name, downloadUrl);
    text = diyKitDeliveryText(name, downloadUrl);
  } else if (kind === "setup_standard" || kind === "setup_premium") {
    const invite = inviteEmailBody(kind === "setup_premium" ? "premium" : "standard");
    subject = invite.subject;
    html = setupConfirmationHtml(name);
    text = `${setupConfirmationText(name)}\n\n${invite.lines.join("\n\n")}`;
  } else {
    // pilot
    subject = "Your Pocket Agent Pilot is live";
    html = pilotConfirmationHtml(name);
    text = pilotConfirmationText(name);
  }

  const send = await sendEmail({ from: FROM, to: email, subject, html, text });
  if (!send.ok) {
    console.error("[stripe/webhook] pocket_agent_addon: confirmation email failed", {
      session_id: session.id,
      kind,
      status: send.status,
      error: send.error,
    });
    return;
  }
  console.info("[stripe/webhook] pocket_agent_addon purchase ledgered + emailed", {
    session_id: session.id,
    kind,
    email,
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
      const session = event.data.object as unknown as CheckoutSession;
      if (session.metadata?.source === "pocket_agent_addon") {
        await handlePocketAgentAddonCompleted(session);
      } else if (session.metadata?.source === "pocket_agent") {
        await handlePocketAgentCheckoutCompleted(session);
      } else {
        await handleCheckoutCompleted(session);
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as unknown as CheckoutSession;
      if (session.metadata?.source !== "pocket_agent") {
        await handleCheckoutExpired(session);
      }
    } else if (event.type === "payment_intent.payment_failed") {
      await handlePaymentFailed(event.data.object as unknown as PaymentIntent);
    } else if (event.type === "customer.subscription.created") {
      const sub = event.data.object as unknown as StripeSubscription;
      if (sub.metadata?.source === "pocket_agent") {
        await handlePocketAgentSubscriptionCreated(sub);
      }
      // Tier write is keyed off the price ID (not metadata), so it also covers
      // payment-link subscriptions that lack source=pocket_agent metadata — as long
      // as a pocket_agent_subscriptions row exists for them (see blocker logging).
      await applyPocketAgentTierFromSubscription(sub, "created");
      // Seed the AI Office Launch Kit starter Skills for the paid tier (PA-STARTERSKILL-4).
      // Best-effort + idempotent; no-ops when the brain isn't connected yet (the usual case at
      // create-time — the Starter Pack backfill picks it up once they connect).
      await seedStarterSkillsForSubscription(sub);
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as unknown as StripeSubscription;
      await applyPocketAgentTierFromSubscription(sub, "updated");
      // Re-run on upgrade so newly-unlocked Skills get seeded (idempotent — adds only the delta).
      await seedStarterSkillsForSubscription(sub);
    } else if (event.type === "customer.subscription.trial_will_end") {
      const sub = event.data.object as unknown as StripeSubscription;
      if (sub.metadata?.source === "pocket_agent") {
        await handlePocketAgentTrialWillEnd(sub);
      }
    } else if (event.type === "invoice.payment_succeeded") {
      await handlePocketAgentInvoicePaid(event.data.object as unknown as StripeInvoice);
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as unknown as StripeSubscription;
      await handlePocketAgentSubscriptionDeleted(sub);
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
