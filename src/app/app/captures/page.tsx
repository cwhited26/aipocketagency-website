// /app/captures — the rich Captures dashboard (PC-CORE-6). Open to ALL logged-in PA users: the
// dashboard is a permanent PA feature, every tier sees it. Captures live in the owner's brain at
// memory/inbox.md (the shared Capture Inbox write path used by every capture surface), so we read +
// parse that file server-side and hand the whole feed to the client, which searches / filters /
// paginates in-memory.
//
// Gating is the pure decideCapturesView contract (unit-tested): logged out → login; a Pocket Capture
// buyer who hasn't finished the PC-MARK-3 wizard → the wizard; no brain connected → an empty state
// with a connect CTA; otherwise → the feed.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { decideCapturesView } from "@/lib/pocket-capture/dashboard";
import { loadDashboardCaptures } from "@/lib/pocket-capture/captures-source";
import { isPocketCaptureUser } from "@/lib/pocket-capture/entitlement";
import { readOnboardingCompletedAt } from "@/lib/pocket-capture/onboarding";
import { redirect } from "next/navigation";
import Link from "next/link";
import CapturesClient from "./CapturesClient";
import { UpgradeToPaCardSlot } from "./_components/UpgradeToPaCardSlot";

export const dynamic = "force-dynamic";

function CapturesEmptyState() {
  return (
    <div className="min-h-full bg-[#06080b] px-5 py-16">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <span aria-hidden className="text-4xl">
          🧠
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-50">
          Connect your brain to start capturing
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Captures land in your brain — the memory your agent reads from. Connect a brain repo and
          everything you forward, text, share, or speak shows up right here.
        </p>
        <Link
          href="/app/onboarding"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-base font-semibold text-slate-950 transition active:scale-[0.99] hover:bg-cyan-300"
        >
          Connect your brain →
        </Link>
      </div>
    </div>
  );
}

export default async function CapturesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login?next=/app/captures");

  const paResult = await fetchPaUser(user.id);
  const paUser = paResult.ok ? paResult.data : null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const ghToken = paUser?.github_token ?? session?.provider_token ?? null;
  const hasBrain = Boolean(paUser?.brain_repo && ghToken);

  // Only Pocket Capture standalone buyers get the wizard redirect (regular PA users onboard
  // elsewhere). Fail open on an infra error: treat as onboarded so a buyer is never trapped looping.
  const entitled = await isPocketCaptureUser({ userId: user.id, email: user.email ?? null });
  const isBuyer = entitled.ok ? entitled.data : false;
  const completed = isBuyer ? await readOnboardingCompletedAt(user.id) : { ok: true as const, data: null };
  const onboardingDone = !isBuyer ? true : completed.ok ? Boolean(completed.data) : true;

  const view = decideCapturesView({
    hasUser: true,
    hasBrain,
    isPocketCaptureBuyer: isBuyer,
    onboardingDone,
  });

  if (view === "onboarding") redirect("/app/captures/onboarding");
  if (view === "no-brain" || !paUser?.brain_repo || !ghToken) return <CapturesEmptyState />;

  // The unified feed: every capture from memory/inbox.md AND every inbox/** file, merged newest-first.
  const captures = await loadDashboardCaptures(paUser.brain_repo, ghToken);

  // The PC-MARK-5 upgrade pitch self-gates server-side (renders null for everyone but an eligible
  // standalone-only buyer) — mount it at the top of the feed as that lane intended.
  return (
    <CapturesClient initialCaptures={captures} nowMs={Date.now()} topSlot={<UpgradeToPaCardSlot />} />
  );
}
