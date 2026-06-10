import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FirstLoginWelcome } from "../_components/FirstLoginWelcome";

// /app/welcome — the Part 7B first-login experience (Welcome → bottleneck picker → 7-day setup
// path). Kept distinct from /app/onboarding (the GitHub/brain-connect wizard) so the two flows stay
// independent. Reachable from the dashboard "Continue Setup" path and linked post-checkout.
export default async function WelcomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  return <FirstLoginWelcome />;
}
