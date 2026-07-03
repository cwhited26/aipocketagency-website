// /app/settings/voice — the Voice Call setup surface (spec build-step 8).
//
// Pick the Persona that answers (default: the owner's Admin Assistant), pick an ElevenLabs voice from
// the curated 12 (Studio+ can enter a custom id), provision your own number (Workspace+) or attach to
// the shared pool (lower tiers), place a test call, and watch your minute usage. Server component:
// resolve auth, the voice connection, Personas, tier, usage, and configuration/flag state, then hand
// it to the client card.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listPersonasForBusiness } from "@/lib/personas/db";
import { getPersonaDisplayName } from "@/lib/personas/types";
import { getCurrentTier, TIER_LABELS } from "@/lib/personas/tier-caps";
import {
  tierAllowsOwnVoiceNumber,
  tierAllowsCustomVoiceId,
  voiceMonthlyMinuteCap,
} from "@/lib/tiers/voice";
import { getVoiceConnection } from "@/lib/channels/voice/connection";
import { listRecentVoiceCalls, sumVoiceSecondsSince } from "@/lib/channels/voice/calls-store";
import { startOfUtcMonthIso } from "@/lib/channels/voice/usage";
import { voiceCallEnabled } from "@/lib/channels/voice/feature-flag";
import { twilioEnv, elevenLabsApiKey, whisperApiKey } from "@/lib/channels/voice/env";
import { VOICE_CATALOG } from "@/lib/channels/voice/catalog";
import VoiceSettingsClient from "./VoiceSettingsClient";

export const dynamic = "force-dynamic";

export default async function VoiceSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login?next=/app/settings/voice");

  const now = new Date();
  const [connection, personas, tier, recentCalls, monthSeconds] = await Promise.all([
    getVoiceConnection(user.id),
    listPersonasForBusiness(user.id),
    getCurrentTier(user.id),
    listRecentVoiceCalls(user.id, 30),
    sumVoiceSecondsSince(user.id, startOfUtcMonthIso(now)),
  ]);

  const monthlyCap = voiceMonthlyMinuteCap(tier);
  const configured = Boolean(twilioEnv() && elevenLabsApiKey() && whisperApiKey());

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-7">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-slate-100">Voice Call</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Call your agent. They pick up, you talk, they answer in their own voice, and you hang up
            when you&apos;re done. Anything you&apos;d text them, you can say out loud — and anything
            that sends or changes something gets staged for your okay first.
          </p>
        </header>

        <VoiceSettingsClient
          flagEnabled={voiceCallEnabled()}
          configured={configured}
          connected={connection.connected}
          enabled={connection.enabled}
          phoneNumber={connection.phoneNumber}
          pool={connection.config?.pool ?? null}
          callerNumber={connection.config?.callerNumber ?? null}
          currentPersonaId={connection.personaId}
          currentVoiceId={connection.config?.voiceId ?? null}
          personas={personas.map((p) => ({ id: p.id, name: getPersonaDisplayName(p) }))}
          voiceCatalog={VOICE_CATALOG.map((v) => ({ id: v.id, label: v.label, blurb: v.blurb }))}
          tierLabel={TIER_LABELS[tier]}
          canUseOwnNumber={tierAllowsOwnVoiceNumber(tier)}
          canUseCustomVoice={tierAllowsCustomVoiceId(tier)}
          monthlyCapMinutes={monthlyCap}
          usedMinutesThisMonth={Math.round(monthSeconds / 60)}
          recentCalls={recentCalls.map((c) => ({
            id: c.id,
            startedAt: c.started_at,
            durationSeconds: c.duration_seconds,
            status: c.status,
          }))}
        />
      </div>
    </div>
  );
}
