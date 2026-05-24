import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
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
