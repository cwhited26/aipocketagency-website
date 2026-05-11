import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "v1";

function envSecret(): string | null {
  const s = process.env.UNSUBSCRIBE_SECRET;
  return s && s.length >= 16 ? s : null;
}

function hmac(secret: string, leadId: string): string {
  return createHmac("sha256", secret).update(`${PREFIX}:${leadId}`).digest("hex");
}

export type SignedTokenResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

export function signUnsubscribeToken(leadId: string): SignedTokenResult {
  const secret = envSecret();
  if (!secret) {
    return { ok: false, error: "UNSUBSCRIBE_SECRET not set" };
  }
  return { ok: true, token: hmac(secret, leadId) };
}

export function verifyUnsubscribeToken(leadId: string, token: string): boolean {
  const secret = envSecret();
  if (!secret) return false;
  const expected = hmac(secret, leadId);
  const expectedBuf = Buffer.from(expected, "utf8");
  const provided = Buffer.from(token, "utf8");
  if (provided.length !== expectedBuf.length) return false;
  return timingSafeEqual(provided, expectedBuf);
}

export function unsubscribeUrl(origin: string, leadId: string): string {
  const result = signUnsubscribeToken(leadId);
  if (!result.ok) {
    return `${origin}/api/apa/unsubscribe?error=secret_not_set`;
  }
  const params = new URLSearchParams({ lead: leadId, token: result.token });
  return `${origin}/api/apa/unsubscribe?${params.toString()}`;
}
