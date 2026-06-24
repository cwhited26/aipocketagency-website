// UpgradeToPaCardSlot — the server shim that gates the PC-MARK-5 upgrade pitch. PC-CORE-6 owns the
// /app/captures dashboard; until (and after) it lands, drop <UpgradeToPaCardSlot /> at the top of the
// feed and it self-gates: it resolves the signed-in buyer's entitlement, PA-subscription status,
// capture count, and signup date, runs the pure shouldShowUpgradePitch gate, and renders the client
// card only for an eligible standalone-only buyer. Returns null for everyone else (logged-out, non-
// buyer, paid PA subscriber, or below the value threshold). Additive + self-contained → low conflict.

import { createClient } from "@/lib/supabase/server";
import { checkActiveSubscription, fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent } from "@/lib/pa-brain";
import { parseInboxForDisplay } from "@/lib/pa-inbox";
import { isPocketCaptureUser } from "@/lib/pocket-capture/entitlement";
import { CAPTURE_INBOX_PATH } from "@/lib/pocket-capture/feed";
import { shouldShowUpgradePitch } from "@/lib/pocket-capture/upgrade-pitch";
import { UpgradeToPaCard } from "./UpgradeToPaCard";

export async function UpgradeToPaCardSlot() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Standalone buyer? Fail closed on an infra error — don't pitch someone we can't confirm bought.
  const entitled = await isPocketCaptureUser({ userId: user.id, email: user.email ?? null });
  if (!entitled.ok || !entitled.data) return null;

  // Paid PA subscribers already have the agents — never pitch them. checkActiveSubscription fails
  // OPEN (returns true on infra error), which hides the card — the safe default for a nudge.
  const hasPaSubscription = await checkActiveSubscription(user.id);
  if (hasPaSubscription) return null;

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) return null;
  const pa = paResult.data;

  // Total captures across every surface = entries in the brain's capture inbox. Empty when no brain
  // is provisioned yet (fetchFileContent returns "" → 0 entries).
  let captureCount = 0;
  if (pa.brain_repo) {
    const raw = await fetchFileContent(pa.brain_repo, CAPTURE_INBOX_PATH, pa.github_token);
    captureCount = parseInboxForDisplay(raw).length;
  }

  const show = shouldShowUpgradePitch({
    isPocketCaptureUser: true,
    hasActivePaSubscription: hasPaSubscription,
    captureCount,
    signupAt: pa.created_at,
    nowMs: Date.now(),
  });
  if (!show) return null;

  return <UpgradeToPaCard captureCount={captureCount} />;
}
