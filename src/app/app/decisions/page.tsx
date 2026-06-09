import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listRoundtables } from "@/lib/decisions/db";
import { getCurrentTier, tierAllowsDecisionRoundtable, decisionRoundtableMonthlyCap } from "@/lib/personas/tier-caps";
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

  const [listResult, tier] = await Promise.all([listRoundtables(user.id, 100), getCurrentTier(user.id)]);
  const roundtables: Roundtable[] = listResult.ok ? listResult.data : [];

  return (
    <DecisionsClient
      roundtables={roundtables}
      eligible={tierAllowsDecisionRoundtable(tier)}
      monthlyCap={decisionRoundtableMonthlyCap(tier)}
    />
  );
}
