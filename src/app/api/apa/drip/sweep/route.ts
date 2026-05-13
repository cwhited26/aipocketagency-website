import { NextResponse } from "next/server";
import {
  fetchAbandonedDripEligibleLeads,
  fetchActiveDripEmails,
  fetchDripEligibleLeads,
  hasPriorSentEvent,
  insertApaEmailEvent,
  updateLeadSequenceState,
  type AbandonedDripLeadRow,
  type DripEmailRow,
  type DripLeadRow,
} from "@/lib/wc-admin-supabase";
import { sendEmail } from "@/lib/resend";
import { unsubscribeUrl } from "@/lib/unsubscribe-token";
import { getKitConfig, isKitSlug } from "@/lib/kit-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FROM = "Chase Whited <chase@aipocketagency.com>";
const REPLY_TO = "chase@aipocketagency.com";
const MAX_SENDS_PER_SWEEP = 200;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;
const LEAD_FETCH_LIMIT = 1000;

type SweepDetail = {
  lead_id: string;
  track: "purchaser" | "abandoned";
  key: number;
  outcome: "sent" | "skipped" | "error";
  reason?: string;
};

type SweepReport = {
  sent: number;
  skipped: number;
  errors: number;
  details: SweepDetail[];
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

function readIntArray(state: Record<string, unknown>, key: string): number[] {
  const raw = state[key];
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

function minutesSince(createdAt: string, now: number): number {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return -1;
  return Math.floor((now - created) / MS_PER_MINUTE);
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
  const sent = new Set(readIntArray(lead.email_sequence_state ?? {}, "sent_days"));
  const elapsed = daysSince(lead.created_at, now);
  for (const drip of drips) {
    if (drip.audience !== "purchaser") continue;
    if (!dripAppliesToLead(drip, lead)) continue;
    if (sent.has(drip.day_offset)) continue;
    if (elapsed < drip.day_offset) continue;
    return drip;
  }
  return null;
}

function nextAbandonedDripForLead(
  lead: AbandonedDripLeadRow,
  drips: DripEmailRow[],
  now: number,
): DripEmailRow | null {
  if (lead.checkout_status === "completed") return null;
  const sent = new Set(
    readIntArray(lead.email_sequence_state ?? {}, "abandoned_sent_minutes"),
  );
  const elapsedMinutes = minutesSince(lead.created_at, now);
  for (const drip of drips) {
    if (drip.audience !== "abandoned") continue;
    if (!dripAppliesToLead(drip, lead)) continue;
    const delay = drip.delay_minutes;
    if (delay === null || delay === undefined) continue;
    if (sent.has(delay)) continue;
    if (elapsedMinutes < delay) continue;
    return drip;
  }
  return null;
}

function resumeUrlForLead(lead: DripLeadRow, origin: string): string {
  if (isKitSlug(lead.source) && getKitConfig(lead.source)) {
    return `${origin}/${lead.source}/upgrade-pair/${encodeURIComponent(lead.id)}?resume=1`;
  }
  return `${origin}/${encodeURIComponent(lead.source)}`;
}

function substitute(
  template: string,
  replacements: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(replacements)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

type SendResult =
  | { kind: "sent" }
  | { kind: "skipped"; reason: "already-sent" }
  | { kind: "error"; reason: string };

async function sendDripToLead(
  lead: DripLeadRow,
  drip: DripEmailRow,
  origin: string,
): Promise<SendResult> {
  // Idempotency floor: hourly cron + partial-fail (sendEmail ok, state-update
  // fail) could resend on next tick. The sequence-state check inside
  // nextDripForLead is the fast path; this is the second guard, queried right
  // before the network send so it catches drift across sweeps.
  const prior = await hasPriorSentEvent(lead.id, drip.slug);
  if (!prior.ok) {
    return { kind: "error", reason: `event-check ${prior.status}: ${prior.error}` };
  }
  if (prior.alreadySent) {
    return { kind: "skipped", reason: "already-sent" };
  }

  const replacements: Record<string, string> = {
    UNSUBSCRIBE_URL: unsubscribeUrl(origin, lead.id),
    RESUME_URL: resumeUrlForLead(lead, origin),
  };
  const html = substitute(drip.html_body, replacements);
  const text = substitute(drip.text_body, replacements);

  const send = await sendEmail({
    from: FROM,
    to: lead.email,
    replyTo: REPLY_TO,
    subject: drip.subject,
    html,
    text,
  });
  if (!send.ok) {
    return { kind: "error", reason: `resend ${send.status}: ${send.error}` };
  }

  const existingState = lead.email_sequence_state ?? {};
  const nextState: Record<string, unknown> = {
    ...existingState,
    last_sent_at: new Date().toISOString(),
    last_resend_id: send.id,
  };

  if (drip.audience === "abandoned") {
    const sentMinutes = readIntArray(existingState, "abandoned_sent_minutes");
    const delay = drip.delay_minutes;
    if (delay !== null && delay !== undefined && !sentMinutes.includes(delay)) {
      sentMinutes.push(delay);
      sentMinutes.sort((a, b) => a - b);
    }
    nextState.abandoned_sent_minutes = sentMinutes;
    nextState.last_abandoned_delay_minutes = delay ?? null;
  } else {
    const sentDays = readIntArray(existingState, "sent_days");
    if (!sentDays.includes(drip.day_offset)) {
      sentDays.push(drip.day_offset);
      sentDays.sort((a, b) => a - b);
    }
    nextState.sent_days = sentDays;
    nextState.last_sent_day = drip.day_offset;
  }

  // Write the email_event BEFORE the state patch. If state patch fails,
  // the next sweep's hasPriorSentEvent guard catches the duplicate-send risk;
  // if state patch succeeds and event insert fails, the state still reflects
  // sent + apa_email_events is the system of record for analytics — manual
  // backfill is the recovery path.
  const ev = await insertApaEmailEvent({
    leadId: lead.id,
    emailId: drip.slug,
    event: "sent",
  });
  if (!ev.ok) {
    return { kind: "error", reason: `event ${ev.status}: ${ev.error}` };
  }

  const updated = await updateLeadSequenceState(lead.id, nextState);
  if (!updated.ok) {
    return { kind: "error", reason: `state-update ${updated.status}: ${updated.error}` };
  }

  return { kind: "sent" };
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

  const purchaserLeads = await fetchDripEligibleLeads(LEAD_FETCH_LIMIT);
  if (!purchaserLeads.ok) {
    console.error("[apa/drip/sweep] fetchDripEligibleLeads failed", purchaserLeads);
    return NextResponse.json(
      { error: "lead-fetch failed", status: purchaserLeads.status },
      { status: 500 },
    );
  }

  const abandonedLeads = await fetchAbandonedDripEligibleLeads(LEAD_FETCH_LIMIT);
  if (!abandonedLeads.ok) {
    console.error(
      "[apa/drip/sweep] fetchAbandonedDripEligibleLeads failed",
      abandonedLeads,
    );
    return NextResponse.json(
      { error: "abandoned-lead-fetch failed", status: abandonedLeads.status },
      { status: 500 },
    );
  }

  const now = Date.now();
  const origin = new URL(req.url).origin;
  const report: SweepReport = { sent: 0, skipped: 0, errors: 0, details: [] };

  // Track 1: purchaser drips (day_offset, anchored on lead.created_at after paid).
  for (const lead of purchaserLeads.rows) {
    if (report.sent >= MAX_SENDS_PER_SWEEP) break;
    const drip = nextDripForLead(lead, drips.rows, now);
    if (!drip) {
      report.skipped += 1;
      continue;
    }
    const result = await sendDripToLead(lead, drip, origin);
    if (result.kind === "sent") {
      report.sent += 1;
      report.details.push({
        lead_id: lead.id,
        track: "purchaser",
        key: drip.day_offset,
        outcome: "sent",
      });
    } else if (result.kind === "skipped") {
      report.skipped += 1;
      report.details.push({
        lead_id: lead.id,
        track: "purchaser",
        key: drip.day_offset,
        outcome: "skipped",
        reason: result.reason,
      });
    } else {
      report.errors += 1;
      report.details.push({
        lead_id: lead.id,
        track: "purchaser",
        key: drip.day_offset,
        outcome: "error",
        reason: result.reason,
      });
      console.error("[apa/drip/sweep] purchaser send failed", {
        lead_id: lead.id,
        day_offset: drip.day_offset,
        reason: result.reason,
      });
    }
  }

  // Track 2: abandoned-cart drips (delay_minutes, anchored on lead.created_at).
  for (const lead of abandonedLeads.rows) {
    if (report.sent >= MAX_SENDS_PER_SWEEP) break;
    const drip = nextAbandonedDripForLead(lead, drips.rows, now);
    if (!drip || drip.delay_minutes === null) {
      report.skipped += 1;
      continue;
    }
    const result = await sendDripToLead(lead, drip, origin);
    if (result.kind === "sent") {
      report.sent += 1;
      report.details.push({
        lead_id: lead.id,
        track: "abandoned",
        key: drip.delay_minutes,
        outcome: "sent",
      });
    } else if (result.kind === "skipped") {
      report.skipped += 1;
      report.details.push({
        lead_id: lead.id,
        track: "abandoned",
        key: drip.delay_minutes,
        outcome: "skipped",
        reason: result.reason,
      });
    } else {
      report.errors += 1;
      report.details.push({
        lead_id: lead.id,
        track: "abandoned",
        key: drip.delay_minutes,
        outcome: "error",
        reason: result.reason,
      });
      console.error("[apa/drip/sweep] abandoned send failed", {
        lead_id: lead.id,
        delay_minutes: drip.delay_minutes,
        reason: result.reason,
      });
    }
  }

  return NextResponse.json({
    sent: report.sent,
    skipped: report.skipped,
    errors: report.errors,
    drips_active: drips.rows.length,
    purchaser_leads_considered: purchaserLeads.rows.length,
    abandoned_leads_considered: abandonedLeads.rows.length,
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
