import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  resolveCheckoutTier,
  TIER_PRICE_USD_MONTHLY,
  type PaidTier,
} from "@/lib/personas/tier-caps";
import StartForm from "./StartForm";

const PAGE_URL = "https://aipocketagent.com/start";
const DESCRIPTION =
  "Start your AI Agent Workspace. 14-day free trial, then your plan. Cancel any time. Every plan includes the AI Office Launch Kit, free.";

export const metadata: Metadata = {
  title: "Start your workspace — Pocket Agent",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "You’re one step from your workspace.",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "You’re one step from your workspace.",
    description: DESCRIPTION,
  },
};

// The funnel shows three renamed visible tiers (PA-POS-6). Map the internal ladder rung to the
// name the buyer just saw on /pricing so the order form reads consistently.
const FUNNEL_TIER_LABEL: Record<PaidTier, string> = {
  starter: "Personal Brain",
  pro: "Business Agent",
  pro_plus: "Pro+",
  studio: "Studio",
  studio_plus: "AI Agent Workspace",
};

export default async function StartPage({
  searchParams,
}: {
  searchParams: { tier?: string };
}) {
  // ?tier= is routed in from the /pricing CTAs. Validate against the ladder; anything
  // unknown/missing/enterprise falls back to ’starter’.
  const tier = resolveCheckoutTier(searchParams.tier);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Require login before checkout so the subscription is always tied to a real account.
  // Preserve the chosen tier across the login round-trip.
  if (!user) {
    const next = tier === "starter" ? "/start" : `/start?tier=${tier}`;
    redirect(`/app/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <StartForm
      defaultEmail={user.email ?? ""}
      tier={tier}
      tierLabel={FUNNEL_TIER_LABEL[tier]}
      priceUsd={TIER_PRICE_USD_MONTHLY[tier]}
    />
  );
}
