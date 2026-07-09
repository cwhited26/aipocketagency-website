// Webhook signature verification — positive + negative for both schemes (Ed25519 current, RSA
// legacy), no fall-through from a failed Ed25519 check, and the event-id / event-map contracts
// the receiver route depends on. Keypairs are generated per-run and injected via the env
// overrides, exactly how a GHL key rotation would land.

import { afterEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import {
  GHL_EVENT_TYPE_MAP,
  GhlWebhookEnvelopeSchema,
  verifyGhlWebhookSignature,
  webhookEventId,
} from "../webhook";

const ed = crypto.generateKeyPairSync("ed25519");
const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const edPublicPem = ed.publicKey.export({ type: "spki", format: "pem" }).toString();
const rsaPublicPem = rsa.publicKey.export({ type: "spki", format: "pem" }).toString();

const BODY = JSON.stringify({
  type: "ContactCreate",
  locationId: "loc_123",
  webhookId: "wh_abc",
});

function signEd(body: string): string {
  return crypto.sign(null, Buffer.from(body, "utf8"), ed.privateKey).toString("base64");
}

function signRsa(body: string): string {
  return crypto.sign("RSA-SHA256", Buffer.from(body, "utf8"), rsa.privateKey).toString("base64");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubKeys(): void {
  vi.stubEnv("GHL_WEBHOOK_PUBLIC_KEY", edPublicPem);
  vi.stubEnv("GHL_WEBHOOK_RSA_PUBLIC_KEY", rsaPublicPem);
}

describe("verifyGhlWebhookSignature", () => {
  it("accepts a valid Ed25519 signature (x-ghl-signature)", () => {
    stubKeys();
    const check = verifyGhlWebhookSignature(BODY, {
      ghlSignature: signEd(BODY),
      whSignature: null,
    });
    expect(check).toEqual({ ok: true, scheme: "ed25519" });
  });

  it("accepts a valid legacy RSA signature (x-wh-signature) when Ed25519 is absent", () => {
    stubKeys();
    const check = verifyGhlWebhookSignature(BODY, {
      ghlSignature: null,
      whSignature: signRsa(BODY),
    });
    expect(check).toEqual({ ok: true, scheme: "rsa" });
  });

  it("rejects a tampered body under both schemes", () => {
    stubKeys();
    const tampered = BODY.replace("loc_123", "loc_999");
    expect(
      verifyGhlWebhookSignature(tampered, { ghlSignature: signEd(BODY), whSignature: null }).ok,
    ).toBe(false);
    expect(
      verifyGhlWebhookSignature(tampered, { ghlSignature: null, whSignature: signRsa(BODY) }).ok,
    ).toBe(false);
  });

  it("a failed Ed25519 check never falls through to the RSA path", () => {
    stubKeys();
    // Both headers present; Ed25519 is garbage while RSA would verify. Hard reject.
    const check = verifyGhlWebhookSignature(BODY, {
      ghlSignature: Buffer.from("not-a-real-signature").toString("base64"),
      whSignature: signRsa(BODY),
    });
    expect(check.ok).toBe(false);
  });

  it("rejects when neither signature header is present", () => {
    stubKeys();
    expect(verifyGhlWebhookSignature(BODY, { ghlSignature: null, whSignature: null })).toEqual({
      ok: false,
      reason: "missing_headers",
    });
  });
});

describe("event contracts", () => {
  it("maps the four v1 GHL event types to the SPEC's handler slugs", () => {
    expect(GHL_EVENT_TYPE_MAP).toEqual({
      ContactCreate: "contact.created",
      AppointmentCreate: "appointment.booked",
      InboundMessage: "conversation.message.received",
      OpportunityStatusUpdate: "opportunity.status_changed",
    });
  });

  it("webhookEventId prefers GHL's webhookId and falls back to a body hash", () => {
    const envelope = GhlWebhookEnvelopeSchema.parse(JSON.parse(BODY));
    expect(webhookEventId(envelope, BODY)).toBe("wh_abc");
    const noId = GhlWebhookEnvelopeSchema.parse({ type: "ContactCreate" });
    const a = webhookEventId(noId, '{"type":"ContactCreate"}');
    const b = webhookEventId(noId, '{"type":"ContactCreate"}');
    expect(a).toBe(b);
    expect(a.startsWith("sha256:")).toBe(true);
  });
});
