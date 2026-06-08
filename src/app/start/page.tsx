import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  resolveCheckoutTier,
  TIER_LABELS,
  TIER_PRICE_USD_MONTHLY,
} from "@/lib/personas/tier-caps";
import StartForm from "./StartForm";

const PAGE_URL = "https://aipocketagent.com/start";
const DESCRIPTION =
  "Start your 14-day free trial of Pocket Agent. $37/mo after the trial. Cancel anytime.";

export const metadata: Metadata = {
  title: "Start your 14-day free trial — Pocket Agent",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Start your 14-day free trial — Pocket Agent",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Start your 14-day free trial — Pocket Agent",
    description: DESCRIPTION,
  },
};

export default async function StartPage({
  searchParams,
}: {
  searchParams: { tier?: string };
}) {
  // ?tier= is routed in from the /pricing CTAs. Validate against the SMB ladder;
  // anything unknown/missing/enterprise falls back to 'starter'.
  const tier = resolveCheckoutTier(searchParams.tier);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Require login before checkout so the subscription is always tied to a real
  // account — prevents the email-mismatch orphan that causes the trial loop. Preserve
  // the chosen tier across the login round-trip so a paid buyer lands back on their tier.
  if (!user) {
    const next = tier === "starter" ? "/start" : `/start?tier=${tier}`;
    redirect(`/app/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <StartForm
      defaultEmail={user.email ?? ""}
      tier={tier}
      tierLabel={TIER_LABELS[tier]}
      priceUsd={TIER_PRICE_USD_MONTHLY[tier]}
    />
  );
}
