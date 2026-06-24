// onboarding.ts — Pocket Capture onboarding wizard state + the route-decision logic (PC-MARK-3).
//
// State lives in pocket_agent_users.pocket_capture_onboarding_completed_at (migration 088). The
// wizard sets it once the buyer finishes or explicitly skips the final step. Reads/writes go through
// the service-role REST layer (direct REST, no SDK — standing rule).

import { paEnv, authHeaders } from "./supabase";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** Where a request for the onboarding wizard should resolve to, given the caller's state. */
export type OnboardingRoute = "login" | "launch-kit" | "completed" | "show";

/**
 * Pure guard logic — unit-tested in isolation so the redirect contract is exercised without a live
 * Next request. The server page wires the real redirects to these outcomes:
 *   - no signed-in user            → "login"      (→ /app/login)
 *   - signed-in, NOT a PC buyer    → "launch-kit" (→ /app/launch-kit; regular PA users onboard there)
 *   - PC buyer, already onboarded  → "completed"  (→ /app/captures dashboard; don't re-onboard)
 *   - PC buyer, not yet onboarded  → "show"       (render the wizard)
 */
export function decideOnboardingRoute(state: {
  hasUser: boolean;
  isPocketCaptureUser: boolean;
  completedAt: string | null;
}): OnboardingRoute {
  if (!state.hasUser) return "login";
  if (!state.isPocketCaptureUser) return "launch-kit";
  if (state.completedAt) return "completed";
  return "show";
}

/** Read an owner's onboarding-completed timestamp (null = not yet onboarded). */
export async function readOnboardingCompletedAt(userId: string): Promise<PaResult<string | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/pocket_agent_users` +
      `?id=eq.${encodeURIComponent(userId)}&select=pocket_capture_onboarding_completed_at&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as { pocket_capture_onboarding_completed_at: string | null }[];
  if (rows.length === 0) return { ok: false, status: 404, error: "no such user" };
  return { ok: true, data: rows[0].pocket_capture_onboarding_completed_at };
}

/**
 * Idempotently mark onboarding complete. Only stamps the timestamp when it is still NULL (filtered
 * PATCH), so a double-submit or a re-run keeps the first completion time rather than moving it.
 * Returns the effective completion timestamp either way (the freshly set one, or the pre-existing
 * one re-read when the filtered PATCH matched no rows).
 */
export async function markOnboardingCompleted(
  userId: string,
  nowIso = new Date().toISOString(),
): Promise<PaResult<{ completedAt: string }>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/pocket_agent_users` +
      `?id=eq.${encodeURIComponent(userId)}&pocket_capture_onboarding_completed_at=is.null`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ pocket_capture_onboarding_completed_at: nowIso }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };

  const rows = (await res.json()) as { pocket_capture_onboarding_completed_at: string | null }[];
  if (rows.length > 0 && rows[0].pocket_capture_onboarding_completed_at) {
    return { ok: true, data: { completedAt: rows[0].pocket_capture_onboarding_completed_at } };
  }

  // Filtered PATCH matched no rows → already completed earlier (or the user row is missing). Re-read
  // to return the durable value; surface a 404 if the row genuinely does not exist.
  const existing = await readOnboardingCompletedAt(userId);
  if (!existing.ok) return existing;
  if (existing.data) return { ok: true, data: { completedAt: existing.data } };
  return { ok: false, status: 404, error: "no such user" };
}
