import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  // If the user already has a brain_repo set, onboarding is done.
  const paResult = await fetchPaUser(user.id);
  if (paResult.ok && paResult.data?.brain_repo) {
    redirect("/app/ask");
  }

  // Determine whether GitHub is connected (proxy: user_metadata.user_name set by GitHub OAuth).
  const hasGitHub = Boolean(user.user_metadata?.user_name);

  return <OnboardingClient hasGitHub={hasGitHub} />;
}
