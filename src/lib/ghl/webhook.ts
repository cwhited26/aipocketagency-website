// webhook.ts — GHL Marketplace webhook verification + event routing (SPEC §5.4, Ship 2 §E).
//
// Reality check vs the SPEC draft: GHL marketplace webhooks are NOT HMAC-signed with a per-app
// secret. GHL signs every delivery with ITS OWN platform keys and publishes the public halves:
//   • X-GHL-Signature — Ed25519 over the raw body (current scheme)
//   • X-WH-Signature  — RSA-SHA256 over the raw body (legacy; GHL deprecated it July 1, 2026)
// So verification is a public-key check, fail-closed, preferring Ed25519 and accepting the RSA
// header only while GHL still sends it during the transition. The published keys are pinned
// below; GHL_WEBHOOK_PUBLIC_KEY / GHL_WEBHOOK_RSA_PUBLIC_KEY override them if GHL ever rotates.
//
// Verify against the EXACT raw body — re-serializing the JSON breaks the signature.

import crypto from "node:crypto";
import { z } from "zod";

// GHL's published Ed25519 public key (X-GHL-Signature), from the Webhook Integration Guide.
const GHL_ED25519_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

// GHL's published legacy RSA public key (X-WH-Signature).
const GHL_RSA_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
FrmY602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6
dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfB
csedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpv
uxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF
3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKU
J062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXp
IocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzN
h/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhC
HULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJ
PQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAyk
T1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

export type GhlSignatureCheck =
  | { ok: true; scheme: "ed25519" | "rsa" }
  | { ok: false; reason: "missing_headers" | "bad_signature" | "bad_key" };

export type GhlSignatureHeaders = {
  /** X-GHL-Signature (Ed25519, base64). */
  ghlSignature: string | null;
  /** X-WH-Signature (legacy RSA-SHA256, base64). */
  whSignature: string | null;
};

function ed25519Key(): string {
  return process.env.GHL_WEBHOOK_PUBLIC_KEY ?? GHL_ED25519_PUBLIC_KEY_PEM;
}

function rsaKey(): string {
  return process.env.GHL_WEBHOOK_RSA_PUBLIC_KEY ?? GHL_RSA_PUBLIC_KEY_PEM;
}

/**
 * Verify a delivery against the raw body. Ed25519 (current) wins when its header is present; a
 * delivery carrying only the legacy RSA header still verifies during GHL's transition window.
 * Any header that fails its check is a hard reject — a bad Ed25519 signature never falls
 * through to the RSA path.
 */
export function verifyGhlWebhookSignature(
  rawBody: string,
  headers: GhlSignatureHeaders,
): GhlSignatureCheck {
  if (headers.ghlSignature) {
    try {
      const valid = crypto.verify(
        null,
        Buffer.from(rawBody, "utf8"),
        crypto.createPublicKey(ed25519Key()),
        Buffer.from(headers.ghlSignature, "base64"),
      );
      return valid ? { ok: true, scheme: "ed25519" } : { ok: false, reason: "bad_signature" };
    } catch {
      return { ok: false, reason: "bad_key" };
    }
  }
  if (headers.whSignature) {
    try {
      const valid = crypto.verify(
        "RSA-SHA256",
        Buffer.from(rawBody, "utf8"),
        crypto.createPublicKey(rsaKey()),
        Buffer.from(headers.whSignature, "base64"),
      );
      return valid ? { ok: true, scheme: "rsa" } : { ok: false, reason: "bad_signature" };
    } catch {
      return { ok: false, reason: "bad_key" };
    }
  }
  return { ok: false, reason: "missing_headers" };
}

// ─── Event payloads ───────────────────────────────────────────────────────────

/**
 * The v1 event set (Ship 2 §E), keyed by GHL's real webhook `type` values. Internal handler
 * slugs keep the SPEC's dotted names so Ship 5's real handlers slot in without renames.
 */
export const GHL_EVENT_TYPE_MAP: Record<string, GhlHandledEvent> = {
  ContactCreate: "contact.created",
  AppointmentCreate: "appointment.booked",
  InboundMessage: "conversation.message.received",
  OpportunityStatusUpdate: "opportunity.status_changed",
};

export type GhlHandledEvent =
  | "contact.created"
  | "appointment.booked"
  | "conversation.message.received"
  | "opportunity.status_changed";

export const GhlWebhookEnvelopeSchema = z
  .object({
    type: z.string().min(1),
    locationId: z.string().optional(),
    webhookId: z.string().optional(),
    timestamp: z.string().optional(),
  })
  .passthrough();

export type GhlWebhookEnvelope = z.infer<typeof GhlWebhookEnvelopeSchema>;

/** Deterministic idempotency id for a delivery: GHL's webhookId, else a body-derived hash. */
export function webhookEventId(envelope: GhlWebhookEnvelope, rawBody: string): string {
  if (envelope.webhookId) return envelope.webhookId;
  return `sha256:${crypto.createHash("sha256").update(rawBody).digest("hex")}`;
}

export function payloadDigest(rawBody: string): string {
  return crypto.createHash("sha256").update(rawBody).digest("hex").slice(0, 32);
}

/**
 * v1 handlers: record + acknowledge. The real product reactions — Follow-Up Sweep staging off
 * contact.created, draft replies off conversation.message.received — ship with the GHL Apps in
 * Ship 5. Keeping the dispatch table here means Ship 5 swaps a log line for a handler without
 * touching the receiver route.
 */
export function handleGhlEvent(args: {
  event: GhlHandledEvent;
  ownerId: string;
  locationId: string | null;
  envelope: GhlWebhookEnvelope;
}): void {
  console.warn("[ghl/webhook] event recorded (v1 log-only handler)", {
    event: args.event,
    ownerId: args.ownerId,
    locationId: args.locationId,
  });
}
