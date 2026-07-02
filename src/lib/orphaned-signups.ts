// lib/orphaned-signups.ts — recover pay-first buyers who paid but never logged in.
//
// A buyer whose login email bounced (or who never opened it) has a live, billing subscription and no
// way into their workspace. This sweep runs on a cron: for each recent trial that's linked to an auth
// user who has never signed in, it re-sends the login link and a branded "your workspace is waiting"
// nudge at 24h and again at 72h. The two send stamps ride the subscription row's email_sequence_state
// JSON (no migration needed), so a buyer who logs in — or a cron re-run — never gets a duplicate.

import {
  listRecentPocketAgentTrials,
  patchPocketAgentSequenceState,
} from "@/lib/pocket-agent-supabase";
import { fetchAuthUserById } from "@/lib/auth-admin";
import { sendPocketAgentLoginLink } from "@/lib/pocket-agent-login-link";
import { sendEmail } from "@/lib/resend";

const FROM = "Chase Whited <chase@aipocketagent.com>";
const SITE_ORIGIN = "https://aipocketagent.com";

const HOUR_MS = 60 * 60 * 1000;
const STAMP_24H = "orphan_24h_sent";
const STAMP_72H = "orphan_72h_sent";
// Candidate window — only look back far enough to cover the 72h nudge with margin.
const LOOKBACK_MS = 5 * 24 * HOUR_MS;

export type OrphanSweepResult = {
  scanned: number;
  nudged: number;
  skipped: number;
  failed: number;
};

function waitingHtml(name: string | null): string {
  const greeting = name ? `Hey ${name} —` : "Hey —";
  return `<!doctype html>
<html><body style="margin:0;padding:24px 16px;background:#0b0b0b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;">
<div style="max-width:560px;margin:0 auto;">
<p>${greeting}</p>
<p>Your Pocket Agent workspace is set up and waiting — but it looks like you haven't logged in yet. Your trial is running, so let's get you in.</p>
<p>I just re-sent your login link. Check your inbox for it, or open the login page and enter the email you paid with:</p>
<p><a href="${SITE_ORIGIN}/app/login" style="color:#6ee7b7;">Log in to Pocket Agent →</a></p>
<p>If the link never shows up, reply to this email and I'll sort it out with you.</p>
<p style="margin-top:32px;">&mdash; Chase</p>
</div>
</body></html>`;
}

function waitingText(name: string | null): string {
  const greeting = name ? `Hey ${name} —` : "Hey —";
  return `${greeting}

Your Pocket Agent workspace is set up and waiting — but it looks like you haven't logged in yet. Your trial is running, so let's get you in.

I just re-sent your login link. Check your inbox for it, or open the login page and enter the email you paid with:

${SITE_ORIGIN}/app/login

If the link never shows up, reply to this email and I'll sort it out with you.

— Chase`;
}

/**
 * One sweep. `now` is injected so the cadence is unit-testable. Best-effort per row — one row's
 * failure never aborts the sweep.
 */
export async function sweepOrphanedSignups(now: Date): Promise<
  { ok: true; data: OrphanSweepResult } | { ok: false; error: string }
> {
  const sinceIso = new Date(now.getTime() - LOOKBACK_MS).toISOString();
  const list = await listRecentPocketAgentTrials(sinceIso);
  if (!list.ok) return { ok: false, error: list.error };

  const result: OrphanSweepResult = { scanned: 0, nudged: 0, skipped: 0, failed: 0 };

  for (const row of list.rows) {
    result.scanned++;
    if (!row.stripe_subscription_id || !row.user_id) {
      result.skipped++;
      continue;
    }

    const ageMs = now.getTime() - new Date(row.created_at).getTime();
    const state = row.email_sequence_state ?? {};
    const need24 = ageMs >= 24 * HOUR_MS && state[STAMP_24H] !== true;
    const need72 = ageMs >= 72 * HOUR_MS && state[STAMP_72H] !== true;
    if (!need24 && !need72) {
      result.skipped++;
      continue;
    }

    // Only nudge buyers who have genuinely never signed in — the whole point is an orphaned account.
    const authUser = await fetchAuthUserById(row.user_id);
    if (!authUser.ok || !authUser.user) {
      result.skipped++;
      continue;
    }
    if (authUser.user.last_sign_in_at) {
      // They got in on their own — stamp both so we never revisit this row.
      await patchPocketAgentSequenceState(row.stripe_subscription_id, {
        ...state,
        [STAMP_24H]: true,
        [STAMP_72H]: true,
      });
      result.skipped++;
      continue;
    }

    // Re-send the one-click login link (the working magic link) + the branded nudge.
    const link = await sendPocketAgentLoginLink(row.email);
    const nudge = await sendEmail({
      from: FROM,
      to: row.email,
      subject: "Your Pocket Agent workspace is waiting",
      html: waitingHtml(row.name),
      text: waitingText(row.name),
    });
    if (!link.ok || !nudge.ok) {
      result.failed++;
      continue;
    }

    // Stamp the tier(s) now due. Passing the full merged state keeps whichever stamp was already set.
    const nextState: Record<string, unknown> = { ...state };
    if (need24) nextState[STAMP_24H] = true;
    if (need72) nextState[STAMP_72H] = true;
    await patchPocketAgentSequenceState(row.stripe_subscription_id, nextState);
    result.nudged++;
  }

  return { ok: true, data: result };
}
