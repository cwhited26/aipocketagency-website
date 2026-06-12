import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, tierAllowsCompetitorInspector } from "@/lib/personas/tier-caps";
import { listExtractions } from "@/lib/url-extraction/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import CompetitorInspectorClient from "./CompetitorInspectorClient";

export const dynamic = "force-dynamic";

export default async function CompetitorInspectorPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");
  const paUser = paResult.data;

  const [tier, extractionsResult] = await Promise.all([getCurrentTier(user.id), listExtractions(user.id)]);
  const canRun = tierAllowsCompetitorInspector(tier);
  const extractions = extractionsResult.ok ? extractionsResult.data : [];
  const brainConnected = Boolean(paUser.brain_repo && paUser.github_token);

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-2">
          <Link
            href="/app/apps"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Apps
          </Link>
        </div>

        <div className="mb-8">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            Know what you&apos;re up against
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Competitor Inspector</h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Paste a competitor&apos;s web address. PA reads their site the way a designer would —
            colors, type, layout, what moves and when — and writes a profile into your brain at{" "}
            <code className="text-[#22d3ee]/80 text-xs">competitors/</code>. You approve it before
            it lands. PA records the style and the structure, never their words or images.
          </p>
        </div>

        {!brainConnected && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <p className="text-sm text-amber-200/90">
              Profiles get filed into your brain repo. You can run captures now, but connect your
              brain in{" "}
              <Link href="/app/settings" className="underline hover:text-amber-100">
                Settings
              </Link>{" "}
              before approving a commit.
            </p>
          </div>
        )}

        {canRun ? (
          <CompetitorInspectorClient initialExtractions={extractions} />
        ) : (
          <div className="rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-6">
            <p className="text-sm font-semibold text-slate-100">
              Competitor Inspector is part of Pro+ and above.
            </p>
            <p className="text-[13px] text-slate-400 mt-2 leading-relaxed">
              Each capture runs a real browser against the competitor&apos;s live site and files a
              structured profile in your brain. That&apos;s Pro+ work.
            </p>
            <Link
              href="/pricing"
              className="mt-4 inline-block rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#06080b] hover:bg-[#22d3ee]/90 transition-colors"
            >
              See plans
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
