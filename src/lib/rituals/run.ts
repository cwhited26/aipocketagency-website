// run.ts — the ritual run executor (SPEC §6, PA-RITUAL-5/6).
//
// One fire, one ritual: open a pa_ritual_runs row, dispatch the ritual's target, stage the result as a
// Mission Control card (kind ritual_result), optionally email the owner a digest, then advance the
// ritual's next_run_at and stamp the outcome. On a run failure the failure streak ticks up; at 5
// consecutive failures (RITUAL_MAX_CONSECUTIVE_FAILURES) the ritual auto-pauses and stages a
// ritual_paused card flagging the issue — the Podcast Watch / Capture Inbox error-streak pattern.
//
// Dispatch (v1): a ritual targets ONE shipped App (app_slug) or ONE saved Project Plan (project_plan_id,
// SPEC §4.1). PA has no generic headless App runner yet, so the executor stages a "this fired — here's
// the work waiting" card that deep-links the owner to the target App in Mission Control. That is the
// honest v1 behavior: a scheduled, voice-checked prompt to act, staged where the owner reviews
// everything else. RITUAL_APP_DISPATCH is the seam a future lane wires per-App headless runs into
// without re-shaping this file. A plan-only ritual isn't runnable yet and fails cleanly.
//
// Cost: the scheduling overhead is cost-free (SPEC §8) — the nudge dispatch makes no metered call, so
// the run row records cost_micro_cents=0 and writes no pa_cost_events row (the wrapped App tags its own
// cost under featureSlug 'ritual:<id>' when it actually runs, so logging here would double-count).

import { createInboxItem } from "@/lib/pa-inbox-items";
import { fetchOwnerEmail } from "@/lib/personas/db";
import { sendEmail } from "@/lib/resend";
import { applyRunOutcome, finishRitualRun, insertRitualRun } from "./db";
import { cronNextRun } from "./parser";
import { resolveRitualTarget } from "./seed";
import { RITUAL_MAX_CONSECUTIVE_FAILURES, type Ritual } from "./types";

const DIGEST_FROM = "Pocket Agent <notifications@aipocketagency.com>";
const APP_BASE_URL = "https://aipocketagent.com";

export type RitualRunReport = {
  ritualId: string;
  status: "success" | "failed" | "paused";
  cardId?: string;
  error?: string;
};

/** The result a dispatch produces: the card title/body it staged, plus its rolled-up realized cost. */
type DispatchResult =
  | { ok: true; title: string; bodyMd: string; payload: Record<string, unknown>; costMicroCents: number }
  | { ok: false; error: string };

/**
 * Run one ritual end to end. Always advances the ritual's next_run_at (a failing ritual retries on its
 * normal cadence, never re-fires every tick). Never throws — a thrown dispatch is caught and recorded
 * as a failed run so the cron's loop survives one bad ritual.
 */
export async function runRitual(ritual: Ritual): Promise<RitualRunReport> {
  const now = new Date();
  const runRow = await insertRitualRun(ritual.id);
  const runId = runRow.ok ? runRow.data.id : null;

  let dispatch: DispatchResult;
  try {
    dispatch = await dispatchRitual(ritual);
  } catch (e) {
    dispatch = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  if (!dispatch.ok) {
    return failRun({ ritual, now, runId, error: dispatch.error });
  }

  // Stage the result card (PA-RITUAL-5). A staging failure is itself a run failure.
  const card = await createInboxItem({
    userId: ritual.owner_id,
    kind: "ritual_result",
    title: dispatch.title,
    bodyMd: dispatch.bodyMd,
    source: "ritual-scheduler",
    payload: { ritualId: ritual.id, runId, ...dispatch.payload },
  });
  if (!card.ok) {
    return failRun({ ritual, now, runId, error: `Couldn't stage the result card: ${card.error}` });
  }

  // Email digest delivery (PA-RITUAL-5) — best effort; a send failure doesn't fail the run, since the
  // card already landed. The owner confirmed email delivery when they chose it on the ritual.
  if (ritual.delivery === "email_digest") {
    await deliverDigest(ritual, dispatch.title, dispatch.bodyMd);
  }

  if (runId) {
    await finishRitualRun(runId, {
      status: "success",
      resultCardId: card.data.id,
      errorText: null,
      costMicroCents: dispatch.costMicroCents,
    });
  }

  await applyRunOutcome(ritual.id, {
    nextRunAt: computeNextRunAt(ritual, now),
    lastRunAt: now.toISOString(),
    status: "success",
    consecutiveFailures: 0,
    enabled: true,
  });

  return { ritualId: ritual.id, status: "success", cardId: card.data.id };
}

/** Dispatch the ritual's target. v1: stage a deep-link nudge for app_slug; plan-only isn't runnable. */
async function dispatchRitual(ritual: Ritual): Promise<DispatchResult> {
  if (!ritual.app_slug) {
    return {
      ok: false,
      error: "This ritual targets a saved Project Plan, which the scheduler can't run yet.",
    };
  }
  const target = resolveRitualTarget(ritual.app_slug);
  if (!target) {
    return { ok: false, error: `Unknown target "${ritual.app_slug}" — it may have been renamed.` };
  }

  const href = `${APP_BASE_URL}${target.href}`;
  const lines = [
    `Your ritual **${ritual.name}** fired on schedule.`,
    "",
    `It runs **${target.label}**. ${target.blurb}`,
    "",
    `Open it to run the work and review what comes back: [${target.label}](${href})`,
  ];
  const note = payloadNote(ritual.app_payload);
  if (note) lines.push("", note);

  return {
    ok: true,
    title: `Ritual fired: ${ritual.name}`,
    bodyMd: lines.join("\n"),
    payload: { appSlug: target.slug, appHref: target.href, delivery: ritual.delivery },
    costMicroCents: 0,
  };
}

/** Render any owner-supplied payload as a short context line. Skips an empty payload. */
function payloadNote(payload: Record<string, unknown>): string | null {
  const note = typeof payload.note === "string" ? payload.note.trim() : "";
  if (note) return `Your note for this ritual: ${note}`;
  return null;
}

/** Compute the ritual's next fire time. Falls back to +1 day if the stored cron can't be parsed (it
 *  was validated on create, so this is a backstop that keeps the ritual from losing its cursor). */
function computeNextRunAt(ritual: Ritual, from: Date): string {
  const next = cronNextRun(ritual.schedule_cron, from, {
    biWeekly: ritual.bi_weekly_skip,
    lastRunAt: from,
  });
  if (next) return next.toISOString();
  console.warn("[rituals/run] cron unparseable, falling back to +1d", {
    ritualId: ritual.id,
    cron: ritual.schedule_cron,
  });
  return new Date(from.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

/** Record a failed run, tick the failure streak, and auto-pause + flag at the cap (PA-RITUAL-6). */
async function failRun(params: {
  ritual: Ritual;
  now: Date;
  runId: string | null;
  error: string;
}): Promise<RitualRunReport> {
  const { ritual, now, runId, error } = params;
  const failures = ritual.consecutive_failures + 1;
  const shouldPause = failures >= RITUAL_MAX_CONSECUTIVE_FAILURES;

  if (runId) {
    await finishRitualRun(runId, {
      status: "failed",
      resultCardId: null,
      errorText: error,
      costMicroCents: 0,
    });
  }

  if (shouldPause) {
    await createInboxItem({
      userId: ritual.owner_id,
      kind: "ritual_paused",
      title: `Ritual paused: ${ritual.name}`,
      bodyMd: [
        `**${ritual.name}** failed ${failures} times in a row, so I paused it.`,
        "",
        `Last error: ${error}`,
        "",
        "Open the Ritual Scheduler to fix the setup and resume it, or delete it if you don't need it.",
      ].join("\n"),
      source: "ritual-scheduler",
      payload: { ritualId: ritual.id, runId, consecutiveFailures: failures },
    });
  }

  await applyRunOutcome(ritual.id, {
    nextRunAt: computeNextRunAt(ritual, now),
    lastRunAt: now.toISOString(),
    status: "failed",
    consecutiveFailures: failures,
    enabled: !shouldPause,
  });

  return {
    ritualId: ritual.id,
    status: shouldPause ? "paused" : "failed",
    error,
  };
}

/** Email the ritual's result to the owner when delivery is email_digest. Best effort. */
async function deliverDigest(ritual: Ritual, title: string, bodyMd: string): Promise<void> {
  const email = await fetchOwnerEmail(ritual.owner_id);
  if (!email) {
    console.warn("[rituals/run] email_digest delivery skipped — no owner email", { ritualId: ritual.id });
    return;
  }
  const send = await sendEmail({
    from: DIGEST_FROM,
    to: email,
    subject: title,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px"><pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.5;color:#0f172a">${escapeHtml(
      bodyMd,
    )}</pre><p style="color:#94a3b8;font-size:12px;margin-top:16px">Pocket Agent · Ritual Scheduler</p></div>`,
    text: bodyMd,
  });
  if (!send.ok) {
    console.warn("[rituals/run] email_digest send failed", { ritualId: ritual.id, error: send.error });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
