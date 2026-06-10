// installs.ts — data layer for pa_workflow_vault_installs (PA-VAULT-4..6).
//
// An install row is the scheduled binding for a Workflow Vault recipe: the recipe it points at, the
// persona it runs as, and whether its schedule is live. Recipes themselves are static JSON (recipes.ts).
// All writes use the service-role key; RLS lets owners SELECT their own rows. No SDK — plain fetch
// against the Supabase REST API (same pattern as pa-routines.ts).

import { starterSeedRecipes } from "./recipes";

export type VaultInstall = {
  id: string;
  owner_id: string;
  recipe_slug: string;
  configured_persona_id: string | null;
  schedule_active: boolean;
  installed_at: string;
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

const TABLE = "pa_workflow_vault_installs";
const PURCHASES_TABLE = "pocket_agent_addon_purchases";

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/** List an owner's installed recipes, newest first. */
export async function listVaultInstalls(ownerId: string): Promise<PaResult<VaultInstall[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?owner_id=eq.${encodeURIComponent(ownerId)}&order=installed_at.desc`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as VaultInstall[] };
}

/**
 * Install (or re-bind) a recipe. Idempotent via the (owner_id, recipe_slug) unique index — re-installing
 * the same recipe updates the persona binding and re-arms the schedule rather than duplicating the row.
 */
export async function installRecipe(args: {
  ownerId: string;
  recipeSlug: string;
  personaId: string | null;
}): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const row: Record<string, unknown> = {
    owner_id: args.ownerId,
    recipe_slug: args.recipeSlug,
    schedule_active: true,
    updated_at: new Date().toISOString(),
  };
  if (args.personaId !== null) row.configured_persona_id = args.personaId;

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?on_conflict=owner_id,recipe_slug`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** Pause or resume a recipe's schedule without uninstalling it. */
export async function setScheduleActive(args: {
  ownerId: string;
  recipeSlug: string;
  active: boolean;
}): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?owner_id=eq.${encodeURIComponent(args.ownerId)}&recipe_slug=eq.${encodeURIComponent(args.recipeSlug)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ schedule_active: args.active, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/**
 * Does the owner hold the $47 Workflow Vault purchase? A pocket_agent_addon_purchases row with
 * kind='workflow_vault' is the unlock signal — its presence unlocks all 25 recipes regardless of tier.
 */
export async function ownerHasVaultPurchase(ownerId: string): Promise<boolean> {
  const env = paEnv();
  if ("error" in env) return false;

  const res = await fetch(
    `${env.url}/rest/v1/${PURCHASES_TABLE}?user_id=eq.${encodeURIComponent(ownerId)}&kind=eq.workflow_vault&select=id&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return false;
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows.length > 0;
}

/**
 * Seed the five starter recipes (one per category) for an owner — called by the Launch Kit on
 * subscription activation and on first /app/launch-kit visit. Idempotent via the unique index, so
 * re-seeding is a no-op merge. personaId is optional; the owner can re-bind later from the surface.
 */
export async function seedStarterRecipes(
  ownerId: string,
  personaId: string | null = null,
): Promise<PaResult<{ seeded: number }>> {
  const seeds = starterSeedRecipes();
  let seeded = 0;
  for (const recipe of seeds) {
    const res = await installRecipe({ ownerId, recipeSlug: recipe.slug, personaId });
    if (!res.ok) return { ok: false, status: res.status, error: res.error };
    seeded += 1;
  }
  return { ok: true, data: { seeded } };
}
