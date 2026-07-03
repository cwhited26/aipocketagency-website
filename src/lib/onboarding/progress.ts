// Onboarding progress detection + credit bonuses (PA-POS-36, migration 105).
//
// markOnboardingStepComplete is called by the code path that performs the underlying action —
// the OAuth callback that lands the first Connection, the compose route, the inbox approve
// resolution, the Persona rename, the Ritual insert, the seat invite. It is fire-and-forget
// safe: every failure is a structured warn, never a throw — onboarding bookkeeping must not
// break the product action it rides on (same posture as cost/log). Pre-migration the table
// doesn't exist, every write fails closed, and the chip simply never ticks.
//
// Bonus credits ride the shipped PA-POS-30 machinery instead of patching allowance rows: an
// award is a pa_top_up_purchases row with source='onboarding_bonus', amount_paid_cents=0, and a
// synthetic session key — idempotent by the existing stripe_session_id UNIQUE, folded into the
// cycle by sumTopUpCredits, carried forward on cycle roll like any Top Up. Exactly one credit
// path, no double count. Studio+/Enterprise only (tierGetsCredits) — entry tiers see the same
// checklist with no credit surface, per the PA-POS-30 hard rule.

import { z } from "zod";
import {
  ONBOARDING_COMPLETION_BONUS_CREDITS,
  ONBOARDING_STEP_BONUS_CREDITS,
  ONBOARDING_STEP_SLUGS,
  type OnboardingStepSlug,
} from "@/data/onboarding-steps";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { tierGetsCredits } from "@/lib/metering/credits";
import { getCreditStatus } from "@/lib/metering/allowance";
import { insertTopUpPurchase } from "@/lib/metering/store";
import { onboardingLog } from "./log";

type ServiceEnv = { url: string; key: string };

function serviceEnv(): ServiceEnv | null {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function headers(env: ServiceEnv): Record<string, string> {
  return {
    apikey: env.key,
    Authorization: `Bearer ${env.key}`,
    "Content-Type": "application/json",
  };
}

const TABLE = "pa_onboarding_progress";

const ProgressRowSchema = z.object({
  step_slug: z.enum(ONBOARDING_STEP_SLUGS),
  completed_at: z.string(),
  credits_awarded: z.boolean(),
});

export type OnboardingProgressRow = z.infer<typeof ProgressRowSchema>;

/** Completed steps for this owner. Empty array on any failure — the chip understates rather
 *  than inventing progress. Rows with a slug outside the registry are dropped, not fatal. */
export async function getOnboardingProgress(ownerId: string): Promise<OnboardingProgressRow[]> {
  const env = serviceEnv();
  if (!env) return [];
  const url =
    `${env.url}/rest/v1/${TABLE}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&select=step_slug,completed_at,credits_awarded&limit=${ONBOARDING_STEP_SLUGS.length + 1}`;
  try {
    const res = await fetch(url, { headers: headers(env), cache: "no-store" });
    if (!res.ok) return [];
    const raw = (await res.json()) as unknown[];
    return raw
      .map((r) => ProgressRowSchema.safeParse(r))
      .filter((p): p is { success: true; data: OnboardingProgressRow } => p.success)
      .map((p) => p.data);
  } catch {
    return [];
  }
}

/** The synthetic pa_top_up_purchases session key for one award — the idempotency handle.
 *  `part` is a step slug or 'complete' (the all-six bonus). */
export function onboardingBonusSessionKey(ownerId: string, part: OnboardingStepSlug | "complete"): string {
  return `onboarding_bonus:${ownerId}:${part}`;
}

/**
 * Record a detected step completion. Idempotent — the first call inserts, every later call
 * no-ops on the composite PK. On a genuinely new completion at a credit tier (Studio+/
 * Enterprise), award the step bonus; when the new row is the sixth, award the completion
 * bonus on top. Never throws.
 */
export async function markOnboardingStepComplete(
  ownerId: string,
  step: OnboardingStepSlug,
): Promise<void> {
  const env = serviceEnv();
  if (!env) return;
  try {
    // ignore-duplicates + return=representation: a fresh insert echoes the row, a repeat
    // returns [] — that empty array IS the short-circuit for every action after the first.
    const res = await fetch(`${env.url}/rest/v1/${TABLE}?on_conflict=owner_id,step_slug`, {
      method: "POST",
      headers: { ...headers(env), Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ owner_id: ownerId, step_slug: step }),
      cache: "no-store",
    });
    if (!res.ok) {
      onboardingLog.warn("progress insert failed", { ownerId, step, status: res.status });
      return;
    }
    const rows = (await res.json()) as unknown[];
    if (rows.length === 0) return; // already complete — nothing new happened

    const tier = await getCurrentTier(ownerId);
    if (tierGetsCredits(tier)) {
      // Ensure the current allowance cycle exists BEFORE the ledger row lands, so the bonus's
      // purchased_at falls inside [cycle_start, cycle_end) and sumTopUpCredits picks it up.
      await getCreditStatus(ownerId, { tier });
      const award = await insertTopUpPurchase({
        ownerId,
        stripeSessionId: onboardingBonusSessionKey(ownerId, step),
        creditsAdded: ONBOARDING_STEP_BONUS_CREDITS,
        amountPaidCents: 0,
        source: "onboarding_bonus",
      });
      if (award.ok) {
        await fetch(
          `${env.url}/rest/v1/${TABLE}?owner_id=eq.${encodeURIComponent(ownerId)}&step_slug=eq.${encodeURIComponent(step)}`,
          {
            method: "PATCH",
            headers: { ...headers(env), Prefer: "return=minimal" },
            body: JSON.stringify({ credits_awarded: true }),
            cache: "no-store",
          },
        );
      } else {
        onboardingLog.warn("step bonus award failed", { ownerId, step, status: award.status });
      }
    }

    const completed = await getOnboardingProgress(ownerId);
    if (completed.length === ONBOARDING_STEP_SLUGS.length && tierGetsCredits(tier)) {
      const finish = await insertTopUpPurchase({
        ownerId,
        stripeSessionId: onboardingBonusSessionKey(ownerId, "complete"),
        creditsAdded: ONBOARDING_COMPLETION_BONUS_CREDITS,
        amountPaidCents: 0,
        source: "onboarding_bonus",
      });
      if (!finish.ok) {
        onboardingLog.warn("completion bonus award failed", { ownerId, status: finish.status });
      }
    }
  } catch (e) {
    onboardingLog.warn("progress mark failed (network)", {
      ownerId,
      step,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
