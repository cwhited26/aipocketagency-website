// /app/apps/voice — the Voice App (PA-CHAN-16): Poc answers the phone, and makes calls when
// asked. Studio+ / Enterprise. Server component: auth + tier gate + first page of calls; the
// client owns the dialer modal and the poll while a call is live.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { tierAllowsVoiceApp } from "@/lib/tiers/voice";
import { voiceRealtimeEnabled } from "@/lib/channels/voice/feature-flag";
import { listRecentVoiceCalls } from "@/lib/channels/voice/calls-store";
import { toVoiceCallListView } from "@/lib/channels/voice/realtime/views";
import VoiceAppClient from "./VoiceAppClient";

export const dynamic = "force-dynamic";

export default async function VoiceAppPage({
  searchParams,
}: {
  searchParams: { prefill?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;
  if (!paUser) redirect("/app/onboarding");

  const tier = await getCurrentTier(user.id);
  const unlocked = tierAllowsVoiceApp(tier);
  const calls = unlocked ? await listRecentVoiceCalls(user.id, 50) : [];

  return (
    <VoiceAppClient
      unlocked={unlocked}
      enabled={voiceRealtimeEnabled()}
      initialCalls={calls.map(toVoiceCallListView)}
      prefillNumber={searchParams.prefill ?? ""}
    />
  );
}
