// route-helpers.ts — shared owner-resolution for the Skills API routes. Every route authenticates
// the session, then resolves the owner's brain repo + token (Skills live in the repo, PA-SKILL-1).
// One place so the auth + brain-repo gate reads identically across the routes.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";

export type OwnerSkillCtx =
  | { ok: true; userId: string; repo: string; token: string | null }
  | { ok: false; status: number; error: string };

/** Authenticates the request and resolves the owner's brain repo + GitHub token. Returns a 401
 *  when signed out and a 409 when no brain is connected (Skills have nowhere to live yet). */
export async function resolveOwnerSkillCtx(): Promise<OwnerSkillCtx> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  const paRes = await fetchPaUser(user.id);
  const repo = paRes.ok && paRes.data ? paRes.data.brain_repo : null;
  const token = paRes.ok && paRes.data ? paRes.data.github_token : null;
  if (!repo) {
    return { ok: false, status: 409, error: "Connect your brain (GitHub) in Settings to use Skills." };
  }
  return { ok: true, userId: user.id, repo, token };
}
