// /app/apps/voice/[callId] — one call: live transcript stream, Poc's staged-approval queue,
// speak-as-Poc (outbound), hang-up. Server component fetches the initial snapshot; the client
// polls while the call is live.

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { tierAllowsVoiceApp } from "@/lib/tiers/voice";
import { fetchVoiceCallById } from "@/lib/channels/voice/calls-store";
import { listVoiceCallEvents } from "@/lib/channels/voice/realtime/events-store";
import { toVoiceCallDetailView } from "@/lib/channels/voice/realtime/views";
import CallDetailClient from "./CallDetailClient";

export const dynamic = "force-dynamic";

export default async function VoiceCallDetailPage({ params }: { params: { callId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsVoiceApp(tier)) redirect("/app/apps/voice");

  const call = await fetchVoiceCallById(params.callId, user.id);
  if (!call) notFound();

  const events = await listVoiceCallEvents({ callId: call.id, ownerId: user.id });
  return <CallDetailClient initial={toVoiceCallDetailView(call, events)} />;
}
