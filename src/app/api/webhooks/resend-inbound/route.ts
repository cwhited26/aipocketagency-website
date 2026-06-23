// POST /api/webhooks/resend-inbound — Pocket Capture's Email Forward surface (PC-CORE-2).
//
// Resend delivers inbound mail for capture.aipocketagent.com here, signed via Svix. We verify the
// signature on the RAW body, parse the RFC822 message, resolve the <slug>@capture… recipient to an
// owner, strip the quoted reply chain, stage attachments in Storage, and write the result to the
// owner's Capture Inbox (source="email_forward"). Every delivery is audited; the audit row's UNIQUE
// dedup_key makes a duplicate Resend redelivery a no-op.
//
// We answer 200 for anything we can't (or shouldn't) process — unknown slug, no brain connected,
// duplicate delivery — so Resend doesn't retry a permanently-bad recipient. We answer non-2xx only
// for our own transient faults (signature secret missing, brain commit blip) so a retry can recover.

import { NextResponse } from "next/server";
import { verifyResendSignature } from "@/lib/inbound-email/signature";
import { parseInboundWebhook, type ParsedInboundEmail } from "@/lib/inbound-email/parse";
import { captureSlugFromAddress, lookupOwnerByCaptureSlug } from "@/lib/pocket-capture/slug";
import {
  claimInboundDelivery,
  markProcessed,
  markError,
  releaseInboundClaim,
} from "@/lib/pocket-capture/log";
import { stripQuotedReply } from "@/lib/pocket-capture/reply-stripper";
import { writeEmailCapture } from "@/lib/pocket-capture/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The forwarded body as plain text: prefer the text part, fall back to a crude HTML strip. */
function plainBody(email: ParsedInboundEmail): string {
  if (email.text.trim()) return email.text;
  return email.html.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ");
}

/** First To/recipient that lands on the capture domain, with its slug. */
function captureRecipient(email: ParsedInboundEmail): { slug: string } | null {
  for (const addr of email.toAddrs) {
    const slug = captureSlugFromAddress(addr);
    if (slug) return { slug };
  }
  return null;
}

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    // Misconfiguration, not a client error — fail closed so unsigned mail is never processed.
    return NextResponse.json({ error: "inbound webhook not configured" }, { status: 500 });
  }

  // Verify the signature against the exact bytes BEFORE parsing.
  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id");
  const verified = verifyResendSignature(
    rawBody,
    { id: svixId, timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") },
    secret,
  );
  if (!verified.ok) {
    return NextResponse.json({ error: `signature: ${verified.reason}` }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = parseInboundWebhook(json);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const email = parsed.email;

  const recipient = captureRecipient(email);
  if (!recipient) {
    // Not addressed to the capture domain — accept and ignore (don't trigger a retry).
    return NextResponse.json({ ok: true, ignored: "no capture recipient" });
  }

  // Stable idempotency key: the RFC822 Message-ID survives redelivery; the Svix delivery id is the
  // always-present fallback. (Sig verify already guaranteed svixId is non-null.)
  const dedupKey = email.messageId || svixId || `${recipient.slug}:${email.subject}`;

  const ownerResult = await lookupOwnerByCaptureSlug(recipient.slug);
  if (!ownerResult.ok) {
    return NextResponse.json({ error: ownerResult.error }, { status: ownerResult.status });
  }

  // Unknown slug — audit the attempt (no owner) and accept so Resend stops retrying.
  if (!ownerResult.data) {
    const claim = await claimInboundDelivery({
      ownerId: null,
      fromEmail: email.fromAddr,
      subject: email.subject,
      dedupKey,
      processed: false,
      errorText: `unknown capture slug: ${recipient.slug}`,
    });
    if (!claim.ok) return NextResponse.json({ error: claim.error }, { status: claim.status });
    return NextResponse.json({ ok: true, ignored: "unknown recipient" });
  }
  const owner = ownerResult.data;

  // Claim the delivery. A duplicate redelivery collides on dedup_key → acknowledge without
  // re-capturing.
  const claim = await claimInboundDelivery({
    ownerId: owner.id,
    fromEmail: email.fromAddr,
    subject: email.subject,
    dedupKey,
  });
  if (!claim.ok) return NextResponse.json({ error: claim.error }, { status: claim.status });
  if (claim.duplicate) return NextResponse.json({ ok: true, duplicate: true });

  const auditId = claim.id;
  const strippedBody = stripQuotedReply(plainBody(email));

  const result = await writeEmailCapture({
    owner,
    email,
    strippedBody,
    captureId: auditId,
  });

  if (!result.ok) {
    if (result.reason === "no-brain") {
      // Persistent state until the owner connects a brain — record it and stop retrying.
      await markError(auditId, result.error);
      return NextResponse.json({ ok: true, captured: false, reason: "no-brain" });
    }
    // Transient (e.g. a GitHub commit blip) — release the claim so the Resend retry reprocesses.
    await releaseInboundClaim(auditId);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await markProcessed(auditId);
  return NextResponse.json({
    ok: true,
    captured: true,
    attachmentsStored: result.stored.length,
    attachmentErrors: result.attachmentErrors,
  });
}
