// GET /api/app/skills/starter — the AI Office Launch Kit starter pack for the Skills tab
// (PA-STARTERSKILL-5). Returns the 36 skills grouped by category with the owner's tier, per-skill
// unlocked / seeded / disabled flags, and the full SKILL.md body for the View panel.
//
// The catalog renders for every signed-in owner (so they can see what the pack contains and what an
// upgrade unlocks) even before a brain is connected. When a brain IS connected, this also runs the
// idempotent backfill so the unlocked skills land in the brain the first time the owner opens the pack
// (the common path — the brain is usually connected after the subscription event, not before).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import {
  STARTER_TIER_LABELS,
  starterSkillsByCategory,
  tierUnlocksStarterSkill,
} from "@/lib/starter-skills/catalog";
import { listDisabledStarterSlugs } from "@/lib/starter-skills/db";
import { backfillStarterSkillsForOwner } from "@/lib/launch-kit/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pa = await fetchPaUser(user.id);
  const hasBrain = pa.ok && !!pa.data?.brain_repo && !!pa.data?.github_token;
  const tier = await getCurrentTier(user.id);

  // Land any unlocked-but-unseeded skills before we read the seeded set (best-effort, idempotent).
  if (hasBrain) await backfillStarterSkillsForOwner(user.id);

  const disabled = await listDisabledStarterSlugs(user.id);

  const groups = starterSkillsByCategory().map((g) => ({
    category: g.category,
    label: g.label,
    skills: g.skills.map((s) => {
      const unlocked = tierUnlocksStarterSkill(tier, s.tierRequired);
      return {
        slug: s.slug,
        name: s.name,
        description: s.description,
        whenToUse: s.whenToUse,
        tierRequired: s.tierRequired,
        tierLabel: STARTER_TIER_LABELS[s.tierRequired],
        unlocked,
        disabled: disabled.has(s.slug),
        body: s.body,
      };
    }),
  }));

  return NextResponse.json({ tier, hasBrain, groups });
}
