// /app/captures/onboarding — the Pocket Capture 60-second setup wizard (PC-MARK-3).
//
// Server guard, then the client wizard. The guard contract is the pure decideOnboardingRoute logic
// (unit-tested): not-signed-in → login; signed-in but not a Pocket Capture buyer → PA Launch Kit
// (regular PA users onboard there); already-onboarded → the /app/captures dashboard (don't
// re-onboard); otherwise render the wizard.

import { createClient } from "@/lib/supabase/server";
import { isPocketCaptureUser } from "@/lib/pocket-capture/entitlement";
import { decideOnboardingRoute, readOnboardingCompletedAt } from "@/lib/pocket-capture/onboarding";
import { redirect } from "next/navigation";
import OnboardingClient from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function CaptureOnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const entitled = await isPocketCaptureUser({ userId: user.id, email: user.email ?? null });
  // Fail closed on an infrastructure error: send a non-buyer to Launch Kit rather than leaking the
  // capture-only wizard. A genuine buyer hitting a transient error can simply reload.
  const isBuyer = entitled.ok ? entitled.data : false;

  const completed = isBuyer ? await readOnboardingCompletedAt(user.id) : { ok: true as const, data: null };
  const completedAt = completed.ok ? completed.data : null;

  const route = decideOnboardingRoute({
    hasUser: true,
    isPocketCaptureUser: isBuyer,
    completedAt,
  });

  if (route === "launch-kit") redirect("/app/launch-kit");
  if (route === "completed") redirect("/app/captures");

  return <OnboardingClient />;
}
