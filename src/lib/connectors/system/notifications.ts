// lib/connectors/system/notifications.ts — the three concrete PA system-mail triggers, each a
// thin builder over connector.email.system_send: resolve the recipient, build subject/body +
// deep link, derive the idempotency key from the source event, and send.
//
//   1. Daily Brief ready    → "Your Daily Brief — <date>"        key: daily_brief:<user>:<date>
//   2. Approval needed      → "<connector> action waiting…"      key: approval_needed:<inboxId>
//   3. Connection re-auth   → "<connector> connection expired"   key: connection_reauth:<connId>
//
// All three are best-effort and never throw: the in-app surface (Inbox card / Connections card)
// is the durable signal; the email is the nudge. The caller may inspect the typed result.

import { systemSend, type SystemSendResult } from "@/lib/connectors/system/actions/send";
import { fetchAuthUserEmail } from "@/lib/connectors/system/recipient";

export type NotifyResult = SystemSendResult | { ok: true; status: "skipped"; reason: string };

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

// The PA app origin — deep links target aipocketagent.com (apex; no `app.` subdomain).
// Matches the OAuth redirect base the Connections lane uses, so all PA app links agree.
function appBaseUrl(): string {
  return (process.env.PA_OAUTH_REDIRECT_BASE ?? "https://aipocketagent.com").replace(
    /\/+$/,
    "",
  );
}

function inboxLink(inboxItemId?: string): string {
  const base = `${appBaseUrl()}/app/apps/inbox`;
  return inboxItemId ? `${base}#${encodeURIComponent(inboxItemId)}` : base;
}

function connectionsLink(): string {
  return `${appBaseUrl()}/app/settings/connections`;
}

function shell(bodyHtml: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">${bodyHtml}<p style="color:#94a3b8;font-size:12px;margin-top:24px">From your Pocket Agent.</p></div>`;
}

/** Trim a longer body to a single-line preview for an email summary. */
function preview(text: string, max = 400): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

// ── 1. Daily Brief ready ─────────────────────────────────────────────────────────────

/**
 * Tell the owner their Daily Brief just landed in the Inbox. `dateKey` (YYYY-MM-DD) keys
 * idempotency so the brief is announced once per day even if the routine cron retries; `dateLabel`
 * is the human-readable date in the subject.
 */
export async function notifyDailyBriefReady(input: {
  userId: string;
  dateKey: string;
  dateLabel: string;
  summary: string;
  inboxItemId?: string;
}): Promise<NotifyResult> {
  const recipient = await fetchAuthUserEmail(input.userId);
  if (!recipient.ok) return recipient;
  if (!recipient.email) return { ok: true, status: "skipped", reason: "no recipient email" };

  const link = inboxLink(input.inboxItemId);
  const summary = preview(input.summary);
  const subject = `Your Daily Brief — ${input.dateLabel}`;

  return systemSend({
    userId: input.userId,
    to: recipient.email,
    subject,
    idempotencyKey: `daily_brief:${input.userId}:${input.dateKey}`,
    text:
      `Your Daily Brief for ${input.dateLabel} is ready.\n\n${summary}\n\n` +
      `Open it in your Inbox: ${link}`,
    html: shell(
      `<p>Your Daily Brief for <strong>${esc(input.dateLabel)}</strong> is ready.</p>` +
        `<p style="color:#475569">${esc(summary)}</p>` +
        `<p><a href="${link}">Open it in your Inbox</a></p>`,
    ),
  });
}

// ── 2. Approval needed ───────────────────────────────────────────────────────────────

/**
 * Tell the owner a sub-agent staged an external action that is waiting on their approval. Keyed on
 * the inbox item id so one staged action == one ping, regardless of webhook retries.
 */
export async function notifyApprovalNeeded(input: {
  userId: string;
  connector: string;
  action: string;
  preview: string;
  inboxItemId: string;
}): Promise<NotifyResult> {
  const recipient = await fetchAuthUserEmail(input.userId);
  if (!recipient.ok) return recipient;
  if (!recipient.email) return { ok: true, status: "skipped", reason: "no recipient email" };

  const link = inboxLink(input.inboxItemId);
  const what = `${input.connector} · ${input.action}`;
  const detail = preview(input.preview);
  const subject = `${input.connector} action waiting on your approval`;

  return systemSend({
    userId: input.userId,
    to: recipient.email,
    subject,
    idempotencyKey: `approval_needed:${input.inboxItemId}`,
    text:
      `Your agent wants to run ${what} and needs your approval.\n\n` +
      (detail ? `${detail}\n\n` : "") +
      `Review and approve it here: ${link}`,
    html: shell(
      `<p>Your agent wants to run <strong>${esc(what)}</strong> and needs your approval.</p>` +
        (detail ? `<p style="color:#475569">${esc(detail)}</p>` : "") +
        `<p><a href="${link}">Review and approve</a></p>`,
    ),
  });
}

// ── 3. Connection re-auth needed ─────────────────────────────────────────────────────

/**
 * Tell the owner a Connection's OAuth refresh failed and the connection must be re-authorized.
 * `toEmail` is the connected mailbox address when known (the natural recipient); otherwise the
 * owner's auth email is looked up. Keyed on the connection id so a failing sync cron pings once.
 */
export async function notifyConnectionReauthNeeded(input: {
  userId: string;
  connector: string;
  connectionId: string;
  toEmail?: string | null;
}): Promise<NotifyResult> {
  let to = input.toEmail ?? null;
  if (!to) {
    const recipient = await fetchAuthUserEmail(input.userId);
    if (!recipient.ok) return recipient;
    to = recipient.email;
  }
  if (!to) return { ok: true, status: "skipped", reason: "no recipient email" };

  const link = connectionsLink();
  const subject = `${input.connector} connection expired`;

  return systemSend({
    userId: input.userId,
    to,
    subject,
    idempotencyKey: `connection_reauth:${input.connectionId}`,
    text:
      `Your ${input.connector} connection stopped working — its access expired or was revoked.\n\n` +
      `Reconnect it here to keep your agent working: ${link}\n\n` +
      `Until you reconnect, ${input.connector} actions stay paused.`,
    html: shell(
      `<p>Your <strong>${esc(input.connector)}</strong> connection stopped working — its access ` +
        `expired or was revoked.</p>` +
        `<p><a href="${link}">Reconnect ${esc(input.connector)}</a> to keep your agent working.</p>` +
        `<p style="color:#475569">Until you reconnect, ${esc(input.connector)} actions stay paused.</p>`,
    ),
  });
}
