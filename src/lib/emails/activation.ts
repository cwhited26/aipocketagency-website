// lib/emails/activation.ts — the activation-trigger engine (Part 5G). Two jobs:
//
//  1. enqueueTriggerEmail / cancelTriggerEmails — the inline hooks the app calls when an owner advances
//     (persona created, workflow installed, inbox reviewed, 3-3-3 hit). Re-exported from ./enqueue.
//  2. sweepActivationTriggers — the daily sweep. For each active subscriber it reads activation state
//     and fires the ONE missing-action reminder that fits, at most one per owner per 7 days, idempotent
//     via pa_email_activation_state. The 3-3-3 celebration fires immediately on completion.
//
// Activation signals are measured from the tables that exist:
//   Business Brain assets → pocket_agent_memory_index (indexed brain files)
//   Personas              → personas (business_id)
//   Workflows             → pa_workflow_vault_installs (owner_id)
//   Mission Control review→ pa_inbox_items with status in (approved, rejected)
// (Documented proxies — there is no single "business brain asset" or "workflow" table; these are the
// closest reliable owner-scoped signals.)

import { enqueueTriggerEmail } from "./enqueue";
import { hasTriggerFired } from "./queue";

export { enqueueTriggerEmail } from "./enqueue";

const MISSING_ACTION_TRIGGERS = [
  "triggers.no-bb-after-24h",
  "triggers.bb-no-persona",
  "triggers.persona-no-workflow",
  "triggers.workflow-no-mission-control",
] as const;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase service-role env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/** Count rows in a table matching a PostgREST filter string, capped at `cap`. Degrades to 0 pre-migration. */
async function countRows(table: string, filter: string, cap = 10): Promise<number> {
  const env = paEnv();
  if ("error" in env) return 0;
  const res = await fetch(`${env.url}/rest/v1/${table}?${filter}&select=id&limit=${cap}`, {
    headers: authHeaders(env.key),
    cache: "no-store",
  });
  if (!res.ok) return 0;
  const rows = (await res.json()) as unknown[];
  return rows.length;
}

export type ActivationState = {
  bbAssets: number;
  personaCount: number;
  workflowCount: number;
  reviewedCount: number;
};

export async function readActivationState(ownerId: string): Promise<ActivationState> {
  const enc = encodeURIComponent(ownerId);
  const [bbAssets, personaCount, workflowCount, reviewedCount] = await Promise.all([
    countRows("pocket_agent_memory_index", `user_id=eq.${enc}`),
    countRows("personas", `business_id=eq.${enc}`),
    countRows("pa_workflow_vault_installs", `owner_id=eq.${enc}`),
    countRows("pa_inbox_items", `user_id=eq.${enc}&status=in.(approved,rejected)`),
  ]);
  return { bbAssets, personaCount, workflowCount, reviewedCount };
}

/** True once the owner has reached 3-3-3 (3 Business Brain assets, 3 Personas, 3 workflows). */
export function isThreeThreeThree(s: ActivationState): boolean {
  return s.bbAssets >= 3 && s.personaCount >= 3 && s.workflowCount >= 3;
}

/** The single missing-action reminder that fits the owner's current state, or null if none applies. */
export function pickMissingActionTrigger(
  s: ActivationState,
  hoursSinceStart: number,
): (typeof MISSING_ACTION_TRIGGERS)[number] | null {
  const bbStarted = s.bbAssets > 0;
  if (!bbStarted) return hoursSinceStart >= 24 ? "triggers.no-bb-after-24h" : null;
  if (s.personaCount === 0) return "triggers.bb-no-persona";
  if (s.workflowCount === 0) return "triggers.persona-no-workflow";
  if (s.reviewedCount === 0) return "triggers.workflow-no-mission-control";
  return null;
}

type ActiveSubscriber = {
  ownerId: string;
  email: string;
  firstName: string | null;
  startedAtMs: number;
};

/** Active/trial subscribers with an account, for the activation sweep. Empty pre-migration. */
async function listActiveSubscribers(limit: number): Promise<ActiveSubscriber[]> {
  const env = paEnv();
  if ("error" in env) return [];
  const url =
    `${env.url}/rest/v1/pocket_agent_subscriptions?status=in.(trial,active)&user_id=not.is.null` +
    `&select=user_id,email,name,trial_started_at,created_at&limit=${limit}`;
  const res = await fetch(url, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<{
    user_id: string;
    email: string;
    name: string | null;
    trial_started_at: string | null;
    created_at: string;
  }>;
  return rows.map((r) => ({
    ownerId: r.user_id,
    email: r.email,
    firstName: r.name,
    startedAtMs: Date.parse(r.trial_started_at ?? r.created_at) || Date.now(),
  }));
}

/** Most recent missing-action fire time for an owner, for the 7-day rate limit. null if never. */
async function lastMissingActionFireMs(ownerId: string): Promise<number | null> {
  const env = paEnv();
  if ("error" in env) return null;
  const inList = MISSING_ACTION_TRIGGERS.map((t) => `"${t}"`).join(",");
  const url =
    `${env.url}/rest/v1/pa_email_activation_state?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&trigger_slug=in.(${encodeURIComponent(inList)})&order=fired_at.desc&select=fired_at&limit=1`;
  const res = await fetch(url, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ fired_at: string }>;
  if (rows.length === 0) return null;
  return Date.parse(rows[0].fired_at) || null;
}

export type ActivationSweepStats = { scanned: number; celebrated: number; reminded: number };

export async function sweepActivationTriggers(
  limit = 500,
  nowMs: number = Date.now(),
): Promise<{ ok: true; data: ActivationSweepStats } | { ok: false; error: string }> {
  const subs = await listActiveSubscribers(limit);
  const stats: ActivationSweepStats = { scanned: subs.length, celebrated: 0, reminded: 0 };

  for (const sub of subs) {
    const state = await readActivationState(sub.ownerId);
    const who = { ownerId: sub.ownerId, email: sub.email, firstName: sub.firstName };

    // 3-3-3 celebration fires immediately on completion, bypassing the 7-day reminder cadence.
    if (isThreeThreeThree(state)) {
      const fired = await enqueueTriggerEmail(who, "triggers.three-three-three-complete", nowMs);
      if (fired.ok && fired.count > 0) stats.celebrated += 1;
      continue;
    }

    const hours = (nowMs - sub.startedAtMs) / (60 * 60 * 1000);
    const desired = pickMissingActionTrigger(state, hours);
    if (!desired) continue;

    // Idempotent: never re-fire the same missing-action reminder.
    const already = await hasTriggerFired(sub.ownerId, desired);
    if (already.ok && already.data) continue;

    // Rate limit: at most one missing-action email per owner per 7 days.
    const lastFire = await lastMissingActionFireMs(sub.ownerId);
    if (lastFire !== null && nowMs - lastFire < SEVEN_DAYS_MS) continue;

    const fired = await enqueueTriggerEmail(who, desired, nowMs);
    if (fired.ok && fired.count > 0) stats.reminded += 1;
  }

  return { ok: true, data: stats };
}
