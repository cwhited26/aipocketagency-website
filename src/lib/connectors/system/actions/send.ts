// lib/connectors/system/actions/send.ts — connector.email.system_send.
//
// Internal PA system mail. Unlike connector.gmail.send (an external write that sends AS the user
// and is approval-gated in the Inbox), system_send is PA-originated transactional mail — Daily
// Brief notifications, approval-needed pings, connection re-auth alerts — so it deliberately
// BYPASSES the approval middleware: there is nothing for the user to approve about being told
// their own agent needs them.
//
// Every send is audited to pa_system_email_log and guarded by an idempotency key derived from the
// source event. The audit row is claimed BEFORE the transport call, so a retry that races a prior
// send is deduped at the DB unique constraint rather than producing a second email.

import { sendTransactional } from "@/lib/email/resend";
import {
  claimSystemEmail,
  markSystemEmailFailed,
  markSystemEmailSent,
} from "@/lib/connectors/system/log";

/** Internal connector + action identity (connector.email.system_send). */
export const SYSTEM_EMAIL_CONNECTOR = "email" as const;
export const SYSTEM_SEND_ACTION = "system_send" as const;

export type SystemSendInput = {
  /** PA user id (auth id) the mail belongs to — audited, not necessarily the To address. */
  userId: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Stable key derived from the source event — guarantees one email per event across retries. */
  idempotencyKey: string;
  replyTo?: string;
};

export type SystemSendResult =
  | { ok: true; status: "sent"; resendId: string }
  | { ok: true; status: "deduped" }
  | { ok: false; status: number; error: string };

/**
 * Send one PA system email: claim the idempotency key, send via Resend, and record the outcome in
 * pa_system_email_log. Returns `deduped` when the key was already claimed (no second send). All
 * failures are typed; nothing is thrown, so a notification can never crash the work that triggered
 * it (a routine drop, an approval staging, a sync cycle).
 */
export async function systemSend(input: SystemSendInput): Promise<SystemSendResult> {
  const claim = await claimSystemEmail({
    userId: input.userId,
    toAddress: input.to,
    subject: input.subject,
    idempotencyKey: input.idempotencyKey,
  });
  if (!claim.ok) {
    console.error("[connector.email.system_send] audit claim failed", {
      idempotencyKey: input.idempotencyKey,
      status: claim.status,
      error: claim.error,
    });
    return { ok: false, status: claim.status, error: claim.error };
  }
  if (!claim.data.claimed) {
    // Key already claimed by a prior send — idempotent skip.
    return { ok: true, status: "deduped" };
  }

  const sent = await sendTransactional({
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
    idempotencyKey: input.idempotencyKey,
  });

  if (!sent.ok) {
    await markSystemEmailFailed({
      idempotencyKey: input.idempotencyKey,
      errorMessage: sent.error,
    });
    return { ok: false, status: sent.status, error: sent.error };
  }

  await markSystemEmailSent({
    idempotencyKey: input.idempotencyKey,
    resendId: sent.data.id,
    sentAt: sent.data.sent_at,
  });
  return { ok: true, status: "sent", resendId: sent.data.id };
}
