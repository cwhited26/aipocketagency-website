import { NextResponse } from "next/server";
import {
  fetchActiveDripEmails,
  fetchDripEligibleLeads,
  insertApaEmailEvent,
  updateLeadSequenceState,
  type DripEmailRow,
  type DripLeadRow,
} from "@/lib/wc-admin-supabase";
import { sendEmail } from "@/lib/resend";
import { unsubscribeUrl } from "@/lib/unsubscribe-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FROM = "Chase Whited <chase@aipocketagency.com>";
const REPLY_TO = "chase@aipocketagency.com";
const MAX_SENDS_PER_SWEEP = 200;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LEAD_FETCH_LIMIT = 1000;

type SweepReport = {
  sent: number;
  skipped: number;
  errors: number;
  details: Array<{
    lead_id: string;
    day_offset: number;
    outcome: "sent" | "skipped" | "error";
    reason?: string;
  }>;
};

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${expected}`) return true;
  // Vercel cron sets this header on scheduled invocations
  if (req.headers.get("x-vercel-cron") && header === `Bearer ${expected}`) {
    return true;
  }
  return false;
}

function readSentDays(state: Record<string, unknown>): number[] {
  const raw = state["sent_days"];
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const v of raw) {
    if (typeof v === "number" && Number.isInteger(v)) {
      out.push(v);
    }
  }
  return out;
}

function daysSince(createdAt: string, now: number): number {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return -1;
  return Math.floor((now - created) / MS_PER_DAY);
}

function dripAppliesToLead(drip: DripEmailRow, lead: DripLeadRow): boolean {
  // Per Pipeline Playbook §Drip series:
  //   kit_source IS NULL  → applies to every paid lead (generic nurture)
  //   kit_source = source → applies only to leads with that lead.source
  if (drip.kit_source === null) return true;
  return drip.kit_source === lead.source;
}

function nextDripForLead(
  lead: DripLeadRow,
  drips: DripEmailRow[],
  now: number,
): DripEmailRow | null {
  const sent = new Set(readSentDays(lead.email_sequence_state ?? {}));
  const elapsed = daysSince(lead.created_at, now);
  for (const drip of drips) {
    if (!dripAppliesToLead(drip, lead)) continue;
    if (sent.has(drip.day_offset)) continue;
    if (elapsed < drip.day_offset) continue;
    return drip;
  }
  return null;
}

function substitute(template: string, unsubUrl: string): string {
  return template.split("{{UNSUBSCRIBE_URL}}").join(unsubUrl);
}

async function sendDripToLead(
  lead: DripLeadRow,
  drip: DripEmailRow,
  origin: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const unsubUrl = unsubscribeUrl(origin, lead.id);
  const html = substitute(drip.html_body, unsubUrl);
  const text = substitute(drip.text_body, unsubUrl);

  const send = await sendEmail({
    from: FROM,
    to: lead.email,
    replyTo: REPLY_TO,
    subject: drip.subject,
    html,
    text,
  });
  if (!send.ok) {
    return { ok: false, reason: `resend ${send.status}: ${send.error}` };
  }

  const existingState = lead.email_sequence_state ?? {};
  const sentDays = readSentDays(existingState);
  if (!sentDays.includes(drip.day_offset)) {
    sentDays.push(drip.day_offset);
    sentDays.sort((a, b) => a - b);
  }
  const nextState: Record<string, unknown> = {
    ...existingState,
    sent_days: sentDays,
    last_sent_day: drip.day_offset,
    last_sent_at: new Date().toISOString(),
    last_resend_id: send.id,
  };

  const updated = await updateLeadSequenceState(lead.id, nextState);
  if (!updated.ok) {
    return { ok: false, reason: `state-update ${updated.status}: ${updated.error}` };
  }

  const ev = await insertApaEmailEvent({
    leadId: lead.id,
    emailId: drip.slug,
    event: "sent",
  });
  if (!ev.ok) {
    return { ok: false, reason: `event ${ev.status}: ${ev.error}` };
  }

  return { ok: true };
}

async function runSweep(req: Request): Promise<NextResponse> {
  const drips = await fetchActiveDripEmails();
  if (!drips.ok) {
    console.error("[apa/drip/sweep] fetchActiveDripEmails failed", drips);
    return NextResponse.json(
      { error: "drip-fetch failed", status: drips.status },
      { status: 500 },
    );
  }

  const leads = await fetchDripEligibleLeads(LEAD_FETCH_LIMIT);
  if (!leads.ok) {
    console.error("[apa/drip/sweep] fetchDripEligibleLeads failed", leads);
    return NextResponse.json(
      { error: "lead-fetch failed", status: leads.status },
      { status: 500 },
    );
  }

  const now = Date.now();
  const origin = new URL(req.url).origin;
  const report: SweepReport = { sent: 0, skipped: 0, errors: 0, details: [] };

  for (const lead of leads.rows) {
    if (report.sent >= MAX_SENDS_PER_SWEEP) break;
    const drip = nextDripForLead(lead, drips.rows, now);
    if (!drip) {
      report.skipped += 1;
      continue;
    }
    const result = await sendDripToLead(lead, drip, origin);
    if (result.ok) {
      report.sent += 1;
      report.details.push({
        lead_id: lead.id,
        day_offset: drip.day_offset,
        outcome: "sent",
      });
    } else {
      report.errors += 1;
      report.details.push({
        lead_id: lead.id,
        day_offset: drip.day_offset,
        outcome: "error",
        reason: result.reason,
      });
      console.error("[apa/drip/sweep] send failed", {
        lead_id: lead.id,
        day_offset: drip.day_offset,
        reason: result.reason,
      });
    }
  }

  return NextResponse.json({
    sent: report.sent,
    skipped: report.skipped,
    errors: report.errors,
    drips_active: drips.rows.length,
    leads_considered: leads.rows.length,
    details: report.details,
  });
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runSweep(req);
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runSweep(req);
}
