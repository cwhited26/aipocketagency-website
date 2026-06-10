// progress.ts — data layer for pa_launch_kit_progress (PA-LAUNCHKIT-IMPL-6).
//
// One row per completed step; absence means not-done. All writes use the service-role key; RLS lets
// owners SELECT their own rows. No SDK — plain fetch against the Supabase REST API (pa-routines pattern).

export type LaunchKitProgressRow = {
  id: string;
  owner_id: string;
  step_slug: string;
  completed_at: string;
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

const TABLE = "pa_launch_kit_progress";

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/** The set of step slugs an owner has completed. */
export async function listCompletedSteps(ownerId: string): Promise<PaResult<string[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?owner_id=eq.${encodeURIComponent(ownerId)}&select=step_slug`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Array<{ step_slug: string }>;
  return { ok: true, data: rows.map((r) => r.step_slug) };
}

/** Mark a step complete (idempotent via the owner_id+step_slug unique index). */
export async function markStepComplete(args: {
  ownerId: string;
  stepSlug: string;
}): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?on_conflict=owner_id,step_slug`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify({ owner_id: args.ownerId, step_slug: args.stepSlug }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** Un-mark a step (owner unchecked it). */
export async function unmarkStep(args: {
  ownerId: string;
  stepSlug: string;
}): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?owner_id=eq.${encodeURIComponent(args.ownerId)}&step_slug=eq.${encodeURIComponent(args.stepSlug)}`,
    {
      method: "DELETE",
      headers: { ...authHeaders(env.key), Prefer: "return=minimal" },
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
