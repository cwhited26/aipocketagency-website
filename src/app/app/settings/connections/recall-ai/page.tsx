// Meeting Persona — Recall.ai connection (Settings → Connections → recall-ai). MP-CORE-1.
//
// Tier gate (MP-1): Free / Starter don't see the card; Pro / Pro+ see it with an upgrade chip;
// Studio / Studio+ / Enterprise get the connect UI. The /connect route enforces the same gate
// server-side — this page only decides what to render.

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getCurrentTier,
  tierAllowsMeetingPersona,
  tierCanSeeMeetingPersona,
} from "@/lib/personas/tier-caps";
import { fetchRecallConnectionPublic } from "@/lib/connectors/recall-ai/db";
import RecallAiConnectCard from "./RecallAiConnectCard";

export const dynamic = "force-dynamic";

export default async function RecallAiConnectionPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tier = await getCurrentTier(user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-100">Meeting Persona — Recall.ai</h1>
        <p className="mt-1 text-sm text-slate-500 leading-relaxed">
          Connect Recall.ai so your Persona can join your Zoom, Google Meet, and Teams calls, take the
          note, and stage the follow-up in your Approval Inbox. You approve every move.
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
              Meeting Persona runs on the Studio plan. Your Persona joins the call, takes the note, and
              drafts the follow-up — you approve before anything goes out.
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
        <RecallAiConnectGate userId={user.id} />
      )}
    </div>
  );
}

async function RecallAiConnectGate({ userId }: { userId: string }) {
  const conn = await fetchRecallConnectionPublic(userId);
  const connected = conn.ok ? conn.data.connected : false;
  const verifiedAt = conn.ok ? conn.data.verifiedAt : null;
  return <RecallAiConnectCard connected={connected} verifiedAt={verifiedAt} />;
}
