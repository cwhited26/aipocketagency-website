import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, tierAllowsLandingPageBuilder } from "@/lib/personas/tier-caps";
import { listPages, toView } from "@/lib/landing-pages/pages";
import { listTemplates } from "@/lib/landing-pages/templates";
import { redirect } from "next/navigation";
import Link from "next/link";
import LandingPagesClient from "./LandingPagesClient";
import { DIRECTION_COUNTS } from "@/data/landing-page-templates/directions-meta";

export const dynamic = "force-dynamic";

export default async function LandingPagesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");
  const paUser = paResult.data;

  const [tier, pagesResult] = await Promise.all([getCurrentTier(user.id), listPages(user.id)]);
  const canBuild = tierAllowsLandingPageBuilder(tier);
  const pages = pagesResult.ok ? pagesResult.data.map(toView) : [];

  const templates = listTemplates().map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description,
    bestFor: t.bestFor,
  }));

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
            Your agent builds the page
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Landing Page Builder</h1>
          <Link
            href="/app/apps/landing-pages/templates"
            className="mt-2 inline-block rounded-full border border-[#22d3ee]/30 bg-[#22d3ee]/5 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[#22d3ee]/80 transition-colors hover:border-[#22d3ee]/60 hover:text-[#22d3ee]"
          >
            Powered by {DIRECTION_COUNTS.total} distinct templates →
          </Link>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Describe the page you need. PA picks a layout, writes the copy in your voice from your
            brain, and builds it on your own GitHub and Vercel — and you approve every step before it
            happens. When it&apos;s done you get a live link, and the code is yours to keep. You can
            point your own domain at it later, the same way.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {[
            { n: "1", t: "You describe it", b: "Tell PA what the page is for and pick a layout." },
            { n: "2", t: "PA writes and builds it", b: "Copy in your voice, code on your accounts — staged for your approval, step by step." },
            { n: "3", t: "You get a live link", b: "Approve the steps and your page goes live at its own URL. Add a custom domain when you're ready." },
          ].map((s) => (
            <div key={s.n} className="rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-4 py-4">
              <div className="w-6 h-6 rounded-full bg-[#0b1220] text-[#22d3ee] grid place-items-center text-xs font-bold mb-2">
                {s.n}
              </div>
              <p className="text-sm font-semibold text-slate-100">{s.t}</p>
              <p className="text-[13px] text-slate-400 mt-1 leading-relaxed">{s.b}</p>
            </div>
          ))}
        </div>

        <LandingPagesClient
          initialPages={pages}
          templates={templates}
          canBuild={canBuild}
          hasApiKey={Boolean(paUser.anthropic_api_key)}
        />
      </div>
    </div>
  );
}
