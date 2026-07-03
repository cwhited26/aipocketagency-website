// Server-side assembly for the metering surfaces on an App page (PA-POS-30/31). The page
// resolves entitlement once (hasAppEntitlement) and hands it here; this component decides what
// renders:
//   - Credits chip — ONLY when buildCreditsChipModel returns non-null, i.e. studio_plus /
//     enterprise. Personal Brain and Business Agent get nothing: no chip, no allowance query.
//   - Active-pass chip — when the owner is running on a rented pass.
//   - Conversion nudge — after the 2nd same-App pass in 21 days. The impression is ledgered
//     here (idempotent per newest pass), so /admin/passes can measure nudge → upgrade.

import { getPassDef, type PassAppSlug } from "@/data/project-passes";
import { getCreditStatus } from "@/lib/metering/allowance";
import { buildCreditsChipModel } from "@/lib/metering/credits";
import type { OwnerAppAccess } from "@/lib/metering/entitlement";
import { buildNudgeCopy } from "@/lib/metering/nudge-copy";
import { passDaysLeft } from "@/lib/metering/passes";
import { logCostEvent } from "@/lib/cost/log";
import { CreditsChip } from "./CreditsChip";
import { PassNudgeCard } from "./PassNudgeCard";

export async function MeteringPanel({
  ownerId,
  appSlug,
  access,
  showCredits = true,
}: {
  ownerId: string;
  appSlug: PassAppSlug;
  access: OwnerAppAccess;
  /** False on rentable-but-not-credit-metered Apps (Landing Page Builder) — the chip lives on
   *  the expensive Apps only (SPEC §20); the pass chip + nudge still render. */
  showCredits?: boolean;
}) {
  // Credits: the null-model path is the hard rule — entry tiers skip even the status read.
  const status = showCredits ? await getCreditStatus(ownerId, { tier: access.tier }) : null;
  const chipModel = showCredits ? buildCreditsChipModel(access.tier, status) : null;

  const pass = access.source === "project_pass" ? access.pass : null;
  const def = getPassDef(appSlug);

  const showNudge = access.showConversionNudge;
  if (showNudge) {
    const newestPass = access.passes.find((p) => p.appSlug === appSlug);
    // One impression row per pass generation (not per render) — idempotency key includes the
    // newest pass id, so refreshing the page can't inflate the funnel.
    if (newestPass) {
      await logCostEvent({
        ownerId,
        featureSlug: "project_pass_nudge",
        backend: "vercel",
        costMicroCents: 0,
        idempotencyKey: `nudge:${ownerId}:${appSlug}:${newestPass.id}`,
        metadata: { action: "impression", app_slug: appSlug },
      });
    }
  }

  if (!chipModel && !pass && !showNudge) return null;

  return (
    <div className="flex flex-col gap-3">
      {chipModel ? <CreditsChip model={chipModel} /> : null}
      {pass ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-300/90">
            Project Pass active
            {pass.remainingRunBudget !== null
              ? ` — ${def?.windowLabel ?? "one run"} left`
              : ` — ${passDaysLeft(pass, new Date())} days left`}
          </span>
        </div>
      ) : null}
      {showNudge ? <PassNudgeCard appSlug={appSlug} copy={buildNudgeCopy(appSlug)} /> : null}
    </div>
  );
}
