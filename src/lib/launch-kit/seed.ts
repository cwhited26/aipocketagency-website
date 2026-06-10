// seed.ts — auto-seed the Launch Kit on subscription activation (PA-LAUNCHKIT-IMPL-3).
//
// Every paid subscription ships the Launch Kit, which auto-installs the five starter Workflow Vault
// recipes (one per category). The three starter Personas (Admin / Sales Follow-Up / Content) are seeded
// by the Personas onboarding flow already (Wave 2), so the Launch Kit only needs to seed the recipes.
// Called from the Stripe webhook on subscription.created and lazily on first /app/launch-kit visit for
// owners who predate this. Idempotent — re-seeding merges on the install unique index.

import { seedStarterRecipes } from "@/lib/workflow-vault/installs";

type SeedResult = { ok: true; seeded: number } | { ok: false; error: string };

export async function ensureLaunchKitSeeded(ownerId: string): Promise<SeedResult> {
  const res = await seedStarterRecipes(ownerId, null);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, seeded: res.data.seeded };
}
