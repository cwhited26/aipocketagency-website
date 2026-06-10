import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import BrainHealthClient from "./BrainHealthClient";
import { gatherActivation } from "@/lib/activation/gather";
import { computeActivation, selectNudge } from "@/lib/activation/state";
import { ActivationWidget } from "../_components/ActivationWidget";
import { ActivationNudge } from "../_components/ActivationNudge";

export default async function BrainPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  const paUser = paResult.ok ? paResult.data : null;
  const brainRepo = paUser?.brain_repo ?? null;
  const hasGithubToken = Boolean(user.user_metadata?.user_name);
  const lastIndexed = paUser?.brain_indexed_at ?? null;

  // 3-3-3 activation surface at the top of the dashboard (GTM Phase 4, Part 7C + 7W).
  const activationInput = await gatherActivation(user.id);
  const activation = computeActivation(activationInput);
  const nudge = selectNudge(activationInput);

  return (
    <div className="space-y-4">
      {nudge ? <ActivationNudge nudge={nudge} /> : null}
      <ActivationWidget state={activation} />
      <BrainHealthClient
        brainRepo={brainRepo}
        hasGithubToken={hasGithubToken}
        lastIndexed={lastIndexed}
      />
    </div>
  );
}
