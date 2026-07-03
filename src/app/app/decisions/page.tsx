import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listRoundtables } from "@/lib/decisions/db";
import { getCurrentTier, decisionRoundtableMonthlyCap } from "@/lib/personas/tier-caps";
import { hasAppEntitlement } from "@/lib/metering/entitlement";
import { getPassDef, passPriceCents } from "@/data/project-passes";
import { MeteringPanel } from "@/components/metering/MeteringPanel";
import { PassOfferCard } from "@/components/metering/PassOfferCard";
import { redirect } from "next/navigation";
import DecisionsClient from "./DecisionsClient";
import type { Roundtable } from "@/lib/decisions/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Decisions — Pocket Agent" };

// The Decision Roundtable history (PA-DR §9). Every call the owner had their agents argue out: the
// question, the verdict, whether they saved or rejected it, and which models did the arguing. Tap a row
// to open the full transcript. The roundtable itself starts inline in the Ask box from a decision
// question; this is the ledger of what's been decided.
export default async function DecisionsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");

  // Tier OR active Project Pass (PA-POS-31) — the widened gate. A pass buys one debate; the
  // run budget, not the tier's monthly cap, bounds it.
  const [listResult, tier] = await Promise.all([listRoundtables(user.id, 100), getCurrentTier(user.id)]);
  const access = await hasAppEntitlement(user.id, "roundtable", { tier });
  const roundtables: Roundtable[] = listResult.ok ? listResult.data : [];

  const passDef = getPassDef("roundtable");
  const passEntitled = access.source === "project_pass";

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pt-4 space-y-3">
        {/* Credits chip (Studio+/Enterprise only — renders null below), pass chip, nudge. */}
        <MeteringPanel ownerId={user.id} appSlug="roundtable" access={access} />
        {!access.allowed && passDef ? (
          <PassOfferCard
            offer={{
              appSlug: "roundtable",
              label: passDef.label,
              priceCents: passPriceCents(passDef, tier),
              windowLabel: passDef.windowLabel,
            }}
          />
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        <DecisionsClient
          roundtables={roundtables}
          eligible={access.allowed}
          monthlyCap={passEntitled ? 1 : decisionRoundtableMonthlyCap(tier)}
        />
      </div>
    </div>
  );
}
