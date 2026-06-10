// db.ts — service-role REST for the two starter-Skills tables (migration 070). Direct REST, no SDK
// (repo rule), mirroring lib/pa-supabase.ts. Both tables are owner-scoped with owner-reads-own RLS;
// every write here goes through the service-role key (the seeder runs in the Stripe webhook with no
// session; the disable toggle runs in an owner-gated API route).
//
//   pa_starter_skill_seeds — append/merge audit of which starter skill was seeded into which owner's
//     brain (UNIQUE(owner_id, skill_slug) → re-seed is idempotent; an upgrade adds only new rows).
//   pa_skill_overrides     — per-owner per-skill overrides; v1 carries `disabled` (PA-STARTERSKILL-6).

type Env = { url: string; key: string };

function paEnv(): Env | null {
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

function headers(env: Env, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: env.key,
    Authorization: `Bearer ${env.key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export type DbResult = { ok: true } | { ok: false; error: string };

const SEEDS = "pa_starter_skill_seeds";
const OVERRIDES = "pa_skill_overrides";

/**
 * Record that a starter skill was seeded into an owner's brain. Idempotent on (owner_id, skill_slug)
 * via merge-duplicates, so a webhook retry or a re-run never duplicates a row. Returns the result so
 * the seeder can log a failed stamp without aborting the seed run.
 */
export async function recordStarterSkillSeed(input: {
  ownerId: string;
  skillSlug: string;
  sourceVersion: string;
  seededAtIso: string;
}): Promise<DbResult> {
  const env = paEnv();
  if (!env) return { ok: false, error: "Supabase service-role env not set" };

  const res = await fetch(`${env.url}/rest/v1/${SEEDS}?on_conflict=owner_id,skill_slug`, {
    method: "POST",
    headers: headers(env, { Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({
      owner_id: input.ownerId,
      skill_slug: input.skillSlug,
      source_version: input.sourceVersion,
      seeded_at: input.seededAtIso,
    }),
    cache: "no-store",
  });
  if (res.ok) return { ok: true };
  return { ok: false, error: `seed stamp failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}` };
}

/** The starter-skill slugs already seeded for an owner. Best-effort: returns an empty set on error
 *  (the seeder then treats nothing as seeded — at worst it re-attempts, which is idempotent). */
export async function listSeededStarterSlugs(ownerId: string): Promise<Set<string>> {
  const env = paEnv();
  if (!env) return new Set();
  const res = await fetch(
    `${env.url}/rest/v1/${SEEDS}?owner_id=eq.${encodeURIComponent(ownerId)}&select=skill_slug`,
    { headers: headers(env), cache: "no-store" },
  );
  if (!res.ok) {
    console.warn("[starter-skills/db] listSeededStarterSlugs failed", { ownerId, status: res.status });
    return new Set();
  }
  const rows = (await res.json().catch(() => [])) as Array<{ skill_slug?: unknown }>;
  return new Set(rows.map((r) => r.skill_slug).filter((s): s is string => typeof s === "string"));
}

/** The slugs an owner has explicitly disabled. Best-effort: empty set on error (nothing disabled). */
export async function listDisabledStarterSlugs(ownerId: string): Promise<Set<string>> {
  const env = paEnv();
  if (!env) return new Set();
  const res = await fetch(
    `${env.url}/rest/v1/${OVERRIDES}?owner_id=eq.${encodeURIComponent(ownerId)}&disabled=is.true&select=skill_slug`,
    { headers: headers(env), cache: "no-store" },
  );
  if (!res.ok) {
    console.warn("[starter-skills/db] listDisabledStarterSlugs failed", { ownerId, status: res.status });
    return new Set();
  }
  const rows = (await res.json().catch(() => [])) as Array<{ skill_slug?: unknown }>;
  return new Set(rows.map((r) => r.skill_slug).filter((s): s is string => typeof s === "string"));
}

/** Upsert a per-skill disable override (PA-STARTERSKILL-6). Idempotent on (owner_id, skill_slug). */
export async function setStarterSkillDisabled(input: {
  ownerId: string;
  skillSlug: string;
  disabled: boolean;
}): Promise<DbResult> {
  const env = paEnv();
  if (!env) return { ok: false, error: "Supabase service-role env not set" };

  const res = await fetch(`${env.url}/rest/v1/${OVERRIDES}?on_conflict=owner_id,skill_slug`, {
    method: "POST",
    headers: headers(env, { Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({
      owner_id: input.ownerId,
      skill_slug: input.skillSlug,
      disabled: input.disabled,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (res.ok) return { ok: true };
  return { ok: false, error: `override write failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}` };
}
