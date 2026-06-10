// sprints.ts — data layer for pa_setup_sprints (PA-SPRINT-2..6).
//
// One row per purchased Done-With-You Setup. Created by the Stripe webhook on a setup_standard /
// setup_premium addon purchase; carried through intake → scheduled call → completed. All writes use the
// service-role key; RLS lets owners SELECT their own. The operator admin view reads via the service key
// behind the operator gate (src/lib/operator.ts). No SDK — plain fetch (pa-routines pattern).

import { type SprintTier } from "./calendar-invite-template";

export type SprintIntake = {
  business_name: string;
  offerings: string;
  target_customer: string;
  current_admin_pain: string;
  top_workflows: string[];
};

export type SetupSprint = {
  id: string;
  owner_id: string | null;
  email: string | null;
  tier: SprintTier;
  stripe_session_id: string;
  intake: Partial<SprintIntake>;
  intake_submitted_at: string | null;
  call_scheduled_at: string | null;
  completed_at: string | null;
  current_step: string;
  created_at: string;
  updated_at: string;
};

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
  if (!url || !key) return { error: "Supabase env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

const TABLE = "pa_setup_sprints";

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/**
 * Create a sprint from a completed Done-With-You checkout. Idempotent on stripe_session_id, so webhook
 * retries don't duplicate. current_step starts at 'awaiting_intake'.
 */
export async function createSprintFromCheckout(args: {
  ownerId: string | null;
  email: string | null;
  tier: SprintTier;
  stripeSessionId: string;
}): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const row: Record<string, unknown> = {
    email: args.email,
    tier: args.tier,
    stripe_session_id: args.stripeSessionId,
    current_step: "awaiting_intake",
  };
  if (args.ownerId !== null) row.owner_id = args.ownerId;

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?on_conflict=stripe_session_id`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** The owner's most recent sprint, or null if they have none. */
export async function fetchSprintForOwner(ownerId: string): Promise<PaResult<SetupSprint | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?owner_id=eq.${encodeURIComponent(ownerId)}&order=created_at.desc&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as SetupSprint[];
  return { ok: true, data: rows[0] ?? null };
}

/** All sprints that aren't completed, newest first — the operator admin queue. */
export async function listActiveSprints(): Promise<PaResult<SetupSprint[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?completed_at=is.null&order=created_at.desc`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as SetupSprint[] };
}

/** Submit the owner's pre-call intake. Stamps intake_submitted_at and advances current_step. */
export async function submitIntake(args: {
  ownerId: string;
  intake: SprintIntake;
}): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?owner_id=eq.${encodeURIComponent(args.ownerId)}&completed_at=is.null`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        intake: args.intake,
        intake_submitted_at: new Date().toISOString(),
        current_step: "intake_submitted",
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
