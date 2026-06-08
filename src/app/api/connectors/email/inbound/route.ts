// POST /api/connectors/email/inbound — the Resend inbound-email webhook. One endpoint, both
// verbs: the recipient subdomain decides whether a message is a forward ("act on this") or a
// BCC ("be aware"). We verify the Svix signature on the RAW body first, parse the RFC822
// message, resolve the owner from the <owner> local-part, and dispatch to the matching handler.

import { NextResponse } from "next/server";
import { verifyResendSignature } from "@/lib/inbound-email/signature";
import { parseInboundWebhook, routedRecipient } from "@/lib/inbound-email/parse";
import { lookupOwnerByLocalPart } from "@/lib/inbound-email/addresses";
import { handleInboundForward } from "@/lib/inbound-email/handle-inbound";
import { handleBccAwareness } from "@/lib/inbound-email/handle-bcc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.RESEND_INBOUND_SIGNING_SECRET;
  if (!secret) {
    // Misconfiguration, not a client error — fail closed so unsigned mail is never processed.
    return NextResponse.json({ error: "inbound webhook not configured" }, { status: 500 });
  }

  // Read the raw body BEFORE parsing — the signature covers the exact bytes.
  const rawBody = await req.text();
  const verified = verifyResendSignature(
    rawBody,
    {
      id: req.headers.get("svix-id"),
      timestamp: req.headers.get("svix-timestamp"),
      signature: req.headers.get("svix-signature"),
    },
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

  const routed = routedRecipient(email);
  if (!routed) {
    // Not addressed to one of our subdomains — accept and ignore (don't trigger a retry).
    return NextResponse.json({ ok: true, ignored: "no inbound recipient" });
  }

  const ownerResult = await lookupOwnerByLocalPart(routed.localPart, routed.kind);
  if (!ownerResult.ok) {
    return NextResponse.json({ error: ownerResult.error }, { status: ownerResult.status });
  }
  if (!ownerResult.data) {
    // Unknown address — accept and ignore so Resend doesn't retry a permanently-bad recipient.
    return NextResponse.json({ ok: true, ignored: "unknown recipient" });
  }
  const ownerId = ownerResult.data;

  if (routed.kind === "inbound") {
    const result = await handleInboundForward({ ownerId, toAddress: routed.address, email });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, kind: "inbound", replied: result.replied });
  }

  const result = await handleBccAwareness({ ownerId, toAddress: routed.address, email });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, kind: "bcc", watched: result.watched });
}
