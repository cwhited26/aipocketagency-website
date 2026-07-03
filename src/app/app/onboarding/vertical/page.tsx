// /app/onboarding/vertical — the first stop after checkout / first login (PA-POS-22): pick what
// describes your business, and the workspace seeds itself — three role Personas, their Apps, and
// the tier-unlocked Starter Skills. Auth rides the same middleware + getUser pattern as every
// /app/* page; the sibling /app/onboarding page gates on the decision and sends undecided owners
// here first.

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { hasVerticalDecision } from "@/lib/onboarding/state-db";
import { VERTICALS, verticalTemplates } from "@/lib/onboarding/verticals";
import VerticalPickerClient, { type VerticalTile } from "./VerticalPickerClient";

export const metadata = { title: "Set up your workspace — Pocket Agent" };

export default async function VerticalOnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  // Already decided (picked or skipped) → onward to the brain step, which itself forwards
  // connected owners home.
  if (await hasVerticalDecision(user.id)) redirect("/app/onboarding");

  const tiles: VerticalTile[] = VERTICALS.map((v) => ({
    slug: v.slug,
    label: v.label,
    who: v.who,
    day: v.day,
    avatarSlug: v.avatarSlug,
    personaNames: verticalTemplates(v).map((t) => t.suggestedName),
  }));

  return <VerticalPickerClient tiles={tiles} />;
}
