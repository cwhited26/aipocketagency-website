import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { hasVerticalDecision } from "@/lib/onboarding/state-db";
import { redirect } from "next/navigation";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { update?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  const isUpdate = searchParams.update === "1";

  // The vertical picker is the FIRST onboarding stop (PA-POS-22): no decision yet → pick or
  // skip before the brain step. Fails open past the picker if the state read errors.
  if (!isUpdate && !(await hasVerticalDecision(user.id))) {
    redirect("/app/onboarding/vertical");
  }

  // If brain already connected and not explicitly updating, skip onboarding
  if (paResult.ok && paResult.data?.brain_repo && !isUpdate) {
    redirect("/app/ask");
  }

  const hasGitHub = Boolean(user.user_metadata?.user_name);
  const brainRepo = (paResult.ok && paResult.data?.brain_repo) || null;

  return (
    <OnboardingClient
      hasGitHub={hasGitHub}
      updateMode={isUpdate}
      brainRepo={brainRepo}
    />
  );
}
