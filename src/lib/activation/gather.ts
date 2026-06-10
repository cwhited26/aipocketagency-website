import "server-only";

// lib/activation/gather.ts — server-side assembly of the owner's ActivationInput (GTM Phase 4).
//
// Each signal is computed independently and defensively: any failure (missing table, REST error,
// thrown helper) collapses to a safe zero/false rather than 500ing the dashboard. A wrong-low count
// just shows an earlier activation step, which is the correct fail-safe — we never overstate
// progress. The signals map to the cleanest available source:
//   • businessBrainAssets — completed Launch Kit "brain-*" steps (the 7 BB items, pa_launch_kit_progress)
//   • personas            — non-archived personas for the owner
//   • workflows           — active rituals + installed Workflow Vault recipes (explicit installs only;
//                           seeded default routines are intentionally NOT counted — they'd inflate it)
//   • missionControlReviewed — any inbox item the owner has approved or rejected
//   • launchpadJoined     — no signal yet (Skool join is not tracked); defaults false so the
//                           "join the Launchpad" nudge keeps surfacing. Wire when the join is recorded.

import { listCompletedSteps } from "@/lib/launch-kit/progress";
import { countPersonasForBusiness } from "@/lib/personas/db";
import { countActiveRituals } from "@/lib/rituals/db";
import { listVaultInstalls } from "@/lib/workflow-vault/installs";
import { listInboxItems } from "@/lib/pa-inbox-items";
import type { ActivationInput } from "./state";

async function countBusinessBrainAssets(userId: string): Promise<number> {
  try {
    const res = await listCompletedSteps(userId);
    if (!res.ok) return 0;
    return res.data.filter((slug) => slug.startsWith("brain-")).length;
  } catch {
    return 0;
  }
}

async function countPersonas(userId: string): Promise<number> {
  try {
    return await countPersonasForBusiness(userId);
  } catch {
    return 0;
  }
}

async function countWorkflows(userId: string): Promise<number> {
  let total = 0;
  try {
    const rituals = await countActiveRituals(userId);
    if (rituals.ok) total += rituals.data;
  } catch {
    // active-ritual count unavailable — contribute 0.
  }
  try {
    const installs = await listVaultInstalls(userId);
    if (installs.ok) total += installs.data.length;
  } catch {
    // vault-install count unavailable — contribute 0.
  }
  return total;
}

async function missionControlReviewed(userId: string): Promise<boolean> {
  try {
    const res = await listInboxItems(userId);
    if (!res.ok) return false;
    return res.data.some((item) => item.status === "approved" || item.status === "rejected");
  } catch {
    return false;
  }
}

/** Best-effort ActivationInput for the dashboard widget + nudge. Never throws. */
export async function gatherActivation(userId: string): Promise<ActivationInput> {
  const [businessBrainAssets, personas, workflows, reviewed] = await Promise.all([
    countBusinessBrainAssets(userId),
    countPersonas(userId),
    countWorkflows(userId),
    missionControlReviewed(userId),
  ]);

  return {
    businessBrainAssets,
    personas,
    workflows,
    missionControlReviewed: reviewed,
    launchpadJoined: false,
  };
}
