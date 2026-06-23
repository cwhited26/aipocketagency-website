// Meeting Persona — Deepgram connection (Settings → Connections → deepgram). MP-CORE-2.
//
// Same tier gate as Recall.ai (Meeting Persona is one App, MP-1): Free / Starter don't see the card;
// Pro / Pro+ see it with an upgrade chip; Studio / Studio+ / Enterprise get the connect UI. The
// /deepgram-connect route enforces the same gate server-side.

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getCurrentTier,
  tierAllowsMeetingPersona,
  tierCanSeeMeetingPersona,
} from "@/lib/personas/tier-caps";
import { fetchDeepgramConnectionPublic } from "@/lib/connectors/deepgram/db";
import DeepgramConnectCard from "./DeepgramConnectCard";

export const dynamic = "force-dynamic";

export default async function DeepgramConnectionPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tier = await getCurrentTier(user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-100">Meeting Persona — Deepgram</h1>
        <p className="mt-1 text-sm text-slate-500 leading-relaxed">
          Deepgram turns your meeting audio into a live transcript while the call happens. Pair it
          with Recall.ai and your Persona has the words as they&apos;re spoken.
        </p>
      </div>

      {!tierCanSeeMeetingPersona(tier) ? (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-5">
          <p className="text-sm text-slate-400 leading-relaxed">
            Meeting Persona isn&apos;t on your current plan. It lands on the Studio plan, alongside the
            build-grade tooling.
          </p>
        </div>
      ) : !tierAllowsMeetingPersona(tier) ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              Meeting Persona runs on the Studio plan. Connect Deepgram + Recall.ai and your Persona
              transcribes the call as it happens.
            </p>
            <a
              href="/pricing"
              className="shrink-0 inline-flex items-center rounded-lg border border-amber-400/40 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/10 transition-colors"
            >
              Upgrade
            </a>
          </div>
        </div>
      ) : (
        <DeepgramConnectGate userId={user.id} />
      )}
    </div>
  );
}

async function DeepgramConnectGate({ userId }: { userId: string }) {
  const conn = await fetchDeepgramConnectionPublic(userId);
  const connected = conn.ok ? conn.data.connected : false;
  const verifiedAt = conn.ok ? conn.data.verifiedAt : null;
  return <DeepgramConnectCard connected={connected} verifiedAt={verifiedAt} />;
}
