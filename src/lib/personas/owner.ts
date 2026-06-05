// owner.ts — route-side helpers to resolve the authenticated owner and their brain
// context (repo, GitHub token, Anthropic key), and to assert persona ownership. Only
// imported by route handlers (uses next/headers via createClient).

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchPersona } from "./db";
import type { PersonaRow } from "./types";

export type OwnerContext = {
  userId: string;
  brainRepo: string;
  githubToken: string | null;
  anthropicKey: string | null;
};

export type OwnerResult =
  | { ok: true; ctx: OwnerContext }
  | { ok: false; status: number; error: string };

/** Resolves the signed-in owner + their brain context, or a typed failure. */
export async function resolveOwner(): Promise<OwnerResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok) return { ok: false, status: paResult.status, error: paResult.error };
  if (!paResult.data?.brain_repo) {
    return { ok: false, status: 404, error: "No brain repo connected" };
  }

  return {
    ok: true,
    ctx: {
      userId: user.id,
      brainRepo: paResult.data.brain_repo,
      githubToken: paResult.data.github_token,
      anthropicKey: paResult.data.anthropic_api_key,
    },
  };
}

/** Fetches a persona and asserts it belongs to `businessId`. */
export async function requireOwnedPersona(
  personaId: string,
  businessId: string,
): Promise<{ ok: true; persona: PersonaRow } | { ok: false; status: number; error: string }> {
  const persona = await fetchPersona(personaId);
  if (!persona) return { ok: false, status: 404, error: "Persona not found" };
  if (persona.business_id !== businessId) {
    return { ok: false, status: 403, error: "Not your persona" };
  }
  return { ok: true, persona };
}
