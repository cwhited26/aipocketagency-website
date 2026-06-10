// POST /api/app/apps/workflow-vault/install  { recipe_slug, persona_id? }
// One-tap install of a Workflow Vault recipe (PA-VAULT-4). Gated: the recipe must be unlocked for the
// owner's tier, or the owner must hold the $47 Vault purchase. Installing writes the binding row.
//
// PATCH same path  { recipe_slug, schedule_active } — pause/resume an installed recipe's schedule.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { getRecipe, isRecipeUnlocked } from "@/lib/workflow-vault/recipes";
import {
  installRecipe,
  ownerHasVaultPurchase,
  setScheduleActive,
} from "@/lib/workflow-vault/installs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InstallSchema = z.object({
  recipe_slug: z.string(),
  persona_id: z.string().uuid().nullable().optional(),
});

const ToggleSchema = z.object({
  recipe_slug: z.string(),
  schedule_active: z.boolean(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof InstallSchema>;
  try {
    body = InstallSchema.parse((await req.json().catch(() => ({}))) as unknown);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const recipe = getRecipe(body.recipe_slug);
  if (!recipe) return NextResponse.json({ error: "Unknown recipe" }, { status: 404 });

  const [tier, hasVault] = await Promise.all([
    getCurrentTier(user.id),
    ownerHasVaultPurchase(user.id),
  ]);
  if (!isRecipeUnlocked(recipe, tier, hasVault)) {
    return NextResponse.json(
      {
        error:
          "That workflow isn't unlocked on your plan yet. Upgrade, or add the AI Workflow Vault to open all 25.",
      },
      { status: 403 },
    );
  }

  const res = await installRecipe({
    ownerId: user.id,
    recipeSlug: recipe.slug,
    personaId: body.persona_id ?? null,
  });
  if (!res.ok) {
    console.error("[workflow-vault/install] install failed", {
      user_id: user.id,
      recipe_slug: recipe.slug,
      status: res.status,
      error: res.error,
    });
    return NextResponse.json({ error: "Could not install. Try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof ToggleSchema>;
  try {
    body = ToggleSchema.parse((await req.json().catch(() => ({}))) as unknown);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!getRecipe(body.recipe_slug)) {
    return NextResponse.json({ error: "Unknown recipe" }, { status: 404 });
  }

  const res = await setScheduleActive({
    ownerId: user.id,
    recipeSlug: body.recipe_slug,
    active: body.schedule_active,
  });
  if (!res.ok) {
    console.error("[workflow-vault/install] toggle failed", {
      user_id: user.id,
      recipe_slug: body.recipe_slug,
      status: res.status,
      error: res.error,
    });
    return NextResponse.json({ error: "Could not update. Try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
