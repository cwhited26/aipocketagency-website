// notify.ts — owner-facing notifications for Wave 2 public/widget personas: lead capture
// → PA Inbox + email, monthly cap thresholds (50/80/100%), and abuse-spike alerts. All
// sends are best-effort (a failed email never breaks the visitor's chat turn) and the
// caller is responsible for fire-once gating (markCapNotified / blocked-hour counter) so
// these helpers stay side-effect-simple.

import { createInboxItem } from "@/lib/pa-inbox-items";
import { sendEmail } from "@/lib/resend";
import { getPersonaDisplayName, type PersonaLeadRow, type PersonaRow } from "./types";

const FROM = "Pocket Agent <chase@aipocketagent.com>";
const REPLY_TO = "chase@aipocketagent.com";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

// ── Lead → PA Inbox (+ email) ───────────────────────────────────────────────────────

/**
 * Routes a captured lead into the owner's PA Inbox as kind='persona_lead' with the full
 * transcript + visitor metadata (SPEC v3 §7 owner queue) and emails the owner. The Inbox
 * item is the durable record; the email is the nudge. Both are best-effort.
 */
export async function routeLeadToInbox(params: {
  persona: PersonaRow;
  lead: PersonaLeadRow;
  transcript: Array<{ role: string; content: string }>;
  ownerEmail: string | null;
}): Promise<void> {
  const { persona, lead, transcript, ownerEmail } = params;
  const personaName = getPersonaDisplayName(persona);
  const who = lead.name || lead.email || lead.phone || "A visitor";
  const contactLines = [
    lead.name ? `Name: ${lead.name}` : null,
    lead.email ? `Email: ${lead.email}` : null,
    lead.phone ? `Phone: ${lead.phone}` : null,
  ].filter((l): l is string => l !== null);

  const transcriptMd = transcript
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `**${m.role === "user" ? "Visitor" : personaName}:** ${m.content}`)
    .join("\n\n");

  const bodyMd = [
    `**New lead from ${personaName}** (${lead.source})`,
    "",
    ...contactLines,
    "",
    "---",
    "",
    "### Transcript",
    transcriptMd || "_(no messages)_",
  ].join("\n");

  // Inbox item — durable owner queue with contacted/qualified/junk handled via the
  // leads endpoint; this is the cross-surface notification.
  await createInboxItem({
    userId: persona.business_id,
    kind: "persona_lead",
    title: `New lead from ${personaName}: ${who}`,
    bodyMd,
    source: `persona:${persona.id}`,
    payload: {
      leadId: lead.id,
      personaId: persona.id,
      email: lead.email,
      phone: lead.phone,
      name: lead.name,
      conversationId: lead.conversation_id,
      leadSource: lead.source,
    },
  }).catch(() => {});

  if (ownerEmail) {
    await sendEmail({
      from: FROM,
      to: ownerEmail,
      replyTo: lead.email ?? REPLY_TO,
      subject: `New lead from ${personaName}: ${who}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
  <p>${esc(personaName)} captured a new lead.</p>
  <p>${contactLines.map(esc).join("<br>")}</p>
  <p style="color:#64748b;font-size:13px">The full transcript is in your Pocket Agent inbox.</p>
  <p style="color:#94a3b8;font-size:12px">Built with Pocket Agent.</p>
</div>`,
      text: `${personaName} captured a new lead.\n\n${contactLines.join("\n")}\n\nThe full transcript is in your Pocket Agent inbox.`,
    }).catch(() => {});
  }
}

// ── Monthly cap thresholds ──────────────────────────────────────────────────────────

export async function notifyCapThreshold(params: {
  persona: PersonaRow;
  ownerEmail: string | null;
  threshold: 50 | 80 | 100;
  cap: number;
}): Promise<void> {
  if (!params.ownerEmail) return;
  const { persona, ownerEmail, threshold, cap } = params;
  const personaName = getPersonaDisplayName(persona);
  const subject =
    threshold === 100
      ? `${personaName} hit its monthly message cap`
      : `${personaName} is at ${threshold}% of its monthly message cap`;
  const detail =
    threshold === 100
      ? `Your persona has used all ${cap.toLocaleString()} messages for this month. Its public link and widget are paused for the rest of the month. Upgrade to Studio to lift the cap.`
      : `Your persona has used ${threshold}% of its ${cap.toLocaleString()} monthly messages. It will pause automatically at 100% — upgrade to Studio to lift the cap.`;

  await sendEmail({
    from: FROM,
    to: ownerEmail,
    replyTo: REPLY_TO,
    subject,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto"><p>${esc(detail)}</p><p style="color:#94a3b8;font-size:12px">Built with Pocket Agent.</p></div>`,
    text: detail,
  }).catch(() => {});
}

// ── Abuse spike ─────────────────────────────────────────────────────────────────────

export async function notifyAbuseSpike(params: {
  persona: PersonaRow;
  ownerEmail: string | null;
  blockedThisHour: number;
}): Promise<void> {
  if (!params.ownerEmail) return;
  const { persona, ownerEmail, blockedThisHour } = params;
  const personaName = getPersonaDisplayName(persona);
  const detail = `${personaName} blocked ${blockedThisHour} suspicious messages in the last hour. This can indicate someone probing your public persona. Your privacy zones still protect your data — no action is required, but you may want to review the conversation log or pause the persona if it continues.`;
  await sendEmail({
    from: FROM,
    to: ownerEmail,
    replyTo: REPLY_TO,
    subject: `Heads up: unusual activity on ${personaName}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto"><p>${esc(detail)}</p><p style="color:#94a3b8;font-size:12px">Built with Pocket Agent.</p></div>`,
    text: detail,
  }).catch(() => {});
}
