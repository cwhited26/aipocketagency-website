// lib/email/resend.ts — the single Resend transport for PA-originated *system* transactional
// mail (Daily Brief notifications, approval-needed pings, connection re-auth alerts). This is
// NOT the user-on-behalf reply lane (connector.gmail.send sends AS the user from their own
// Gmail). System mail always goes out from Pocket Agent's own verified sender.
//
// Direct REST against the Resend send endpoint — no SDK (standing rule #6). Every call returns a
// typed Result; transport failures are logged structured and returned, never swallowed.
//
// Verified Resend sender domain: aipocketagent.com (verified 2026-05-23).
// Sender: chase@aipocketagent.com. The legacy aipocketagency.com is NOT canonical —
// see memory/feedback_resend_aipocketagent_verified.md and feedback_pa_domain_is_aipocketagent_com.md
// in the whited-brain repo for the standing rule. (Some legacy senders — lib/personas/notify.ts,
// the connector re-auth alerts, the Stripe webhook — still carry the 'cy' domain pending a sweep;
// this transport's default is the canonical 't' domain.)

const DEFAULT_FROM = "Pocket Agent <chase@aipocketagent.com>";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendTransactionalInput = {
  /** One or more recipient addresses. A bare string is normalized to a single-element list. */
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Defaults to `Pocket Agent <chase@aipocketagent.com>` (the verified sender). */
  from?: string;
  replyTo?: string;
  /**
   * Resend Idempotency-Key. Resend dedupes sends carrying the same key for 24h, so a retried
   * trigger never produces a second email even before our own audit-row guard runs.
   */
  idempotencyKey?: string;
  /** Extra Resend headers (e.g. List-Unsubscribe). Merged after the idempotency header. */
  headers?: Record<string, string>;
};

export type SendTransactionalResult =
  | { ok: true; data: { id: string; sent_at: string } }
  | { ok: false; status: number; error: string };

type ResendSendResponse = { id?: string };

/**
 * POST a transactional email to Resend. Returns the Resend message id plus a client-stamped
 * `sent_at` (the send endpoint does not echo a timestamp). The caller owns idempotency at the
 * audit-log layer; the optional `idempotencyKey` here is the transport-level belt-and-suspenders.
 */
export async function sendTransactional(
  input: SendTransactionalInput,
): Promise<SendTransactionalResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Surface as a typed failure — the trigger logs + audits it; it never crashes the caller.
    return { ok: false, status: 500, error: "RESEND_API_KEY not set" };
  }

  const to = Array.isArray(input.to) ? input.to : [input.to];
  const body: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
    reply_to?: string;
  } = {
    from: input.from ?? DEFAULT_FROM,
    to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  };
  if (input.replyTo) body.reply_to = input.replyTo;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (input.idempotencyKey) headers["Idempotency-Key"] = input.idempotencyKey;
  if (input.headers) Object.assign(headers, input.headers);

  let res: Response;
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : "network error reaching Resend";
    console.error("[email/resend] transport error", { error, to });
    return { ok: false, status: 502, error };
  }

  const raw = await res.text();
  if (!res.ok) {
    console.error("[email/resend] send rejected", { status: res.status, body: raw, to });
    return { ok: false, status: res.status, error: raw };
  }

  let parsed: ResendSendResponse;
  try {
    parsed = JSON.parse(raw) as ResendSendResponse;
  } catch {
    console.error("[email/resend] non-JSON response", { body: raw, to });
    return { ok: false, status: 502, error: `Resend returned non-JSON: ${raw}` };
  }
  if (!parsed.id) {
    console.error("[email/resend] response missing id", { body: raw, to });
    return { ok: false, status: 502, error: `Resend response missing id: ${raw}` };
  }

  return { ok: true, data: { id: parsed.id, sent_at: new Date().toISOString() } };
}

/** The default verified sender, exported so triggers/tests can assert the single source of truth. */
export const SYSTEM_EMAIL_FROM = DEFAULT_FROM;
