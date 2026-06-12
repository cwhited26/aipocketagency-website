import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  getCurrentTier,
  tierAllowsLandingPageBuilder,
  tierCanSeeLandingPageBuilder,
  tierAllowsIdeaEngine,
} from "@/lib/personas/tier-caps";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GlowCard } from "../_components/GlowCard";
import { TabGuide } from "../_components/TabGuide";
import { StarterBox } from "../_components/StarterBox";
import YouTubeExplainerCard from "@/components/youtube/ExplainerCard";
import { APP_CATALOG, type AppDef } from "@/lib/apps/catalog";
import { DIRECTION_COUNTS } from "@/data/landing-page-templates/directions-meta";

// The Apps menu reads from the shared catalog (lib/apps/catalog.ts) — the same source the
// Personas surface uses to let each persona declare which Apps it can reach.
const apps = APP_CATALOG;

function tagClass(color: AppDef["tagColor"]): string {
  if (color === "cyan") {
    return "text-[#22d3ee]/70 border-[#22d3ee]/20 bg-[#22d3ee]/5";
  }
  return "text-slate-600 border-slate-700 bg-transparent";
}

export default async function AppsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;

  if (!paUser) redirect("/app/onboarding");

  const hasApiKey = Boolean(paUser.anthropic_api_key);
  const hasBrain = Boolean(paUser.brain_repo);
  const hasGithubToken = Boolean(paUser.github_token);

  // The Landing Page Builder is Studio-gated (PA-LPB-4): Studio+ build, Pro/Pro+ see the card with an
  // upgrade nudge, the free Starter tier doesn't see it at all.
  const tier = await getCurrentTier(user.id);
  const canBuildLandingPages = tierAllowsLandingPageBuilder(tier);
  // The Idea Engine is a Pro+ feature (PA-IDEA-3). The card is always on the grid — the product
  // exists, so we show it with an "Upgrade to Pro+" chip below Pro+ rather than hiding it (the card
  // vanishing on lower tiers is what made a paying customer think it wasn't shipped). The Idea Engine
  // app page enforces the real gate and shows the same upgrade state for anyone who follows the card.
  const canUseIdeaEngine = tierAllowsIdeaEngine(tier);
  const visibleApps = apps.filter((app) => {
    if (app.id === "landing-page-builder") return tierCanSeeLandingPageBuilder(tier);
    return true;
  });

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            Your agent&apos;s workbench
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Apps</h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Reusable workflows your agent can run on demand.
          </p>
          <p className="text-slate-300 text-sm mt-3 leading-relaxed">
            Apps are the work you do over and over, packaged so your agent can run it in one move —
            an Email Drafter, a Follow-up Radar that spots deals going cold, a Quote / Proposal
            writer. Some are quick. Some are substantial — a full proposal, a sweep across your whole
            pipeline. Each one reads your brain — your services, pricing, voice, history — so the
            output comes back sounding like you, not like a template. Custom apps you build yourself
            are coming, so the workflows that are unique to your business get the same one-tap
            treatment.
          </p>
        </div>

        {!hasApiKey && (
          <div className="mb-5 rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-4 flex items-start gap-3">
            <span className="text-[#22d3ee] shrink-0 mt-0.5 font-mono text-sm">→</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Add your Anthropic API key to run these apps.
              </p>
              <p className="text-sm text-slate-300 mt-1">
                Your key, your bill, your data.{" "}
                <Link href="/app/settings" className="text-[#22d3ee] hover:underline">
                  Go to Settings →
                </Link>
              </p>
            </div>
          </div>
        )}

        {!hasBrain && (
          <div className="mb-5 rounded-xl border border-slate-700/60 bg-slate-900/60 px-5 py-4 flex items-start gap-3">
            <span className="text-slate-400 shrink-0 mt-0.5 font-mono text-sm">◈</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">No brain connected</p>
              <p className="text-sm text-slate-300 mt-1">
                Apps will still run — they just won&apos;t have your services, pricing, or voice to
                pull from.{" "}
                {hasGithubToken ? (
                  <Link href="/app/onboarding" className="text-[#22d3ee] hover:underline">
                    Connect a brain →
                  </Link>
                ) : (
                  <a
                    href="/api/app/auth/github?next=/app/onboarding"
                    className="text-[#22d3ee] hover:underline"
                  >
                    Connect GitHub first →
                  </a>
                )}
              </p>
            </div>
          </div>
        )}

        <div className="mb-6">
          <YouTubeExplainerCard />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibleApps.map((app) => {
            const lockedLandingPages = app.id === "landing-page-builder" && !canBuildLandingPages;
            const lockedIdeaEngine = app.id === "idea-engine" && !canUseIdeaEngine;
            // Either gate puts the card in its "show with upgrade chip" state. The chip text is the
            // tier each App unlocks at — Studio for the builder, Pro+ for the Idea Engine.
            const locked = lockedLandingPages || lockedIdeaEngine;
            const unlockTier = lockedLandingPages ? "Studio" : "Pro+";
            return (
              <GlowCard key={app.href} href={app.href} className="px-5 py-5 group">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2 className="text-sm font-semibold text-slate-100">{app.label}</h2>
                  <span
                    className={`text-[10px] font-mono border rounded px-1.5 py-0.5 uppercase tracking-wider shrink-0 ${
                      locked ? "text-slate-500 border-slate-700 bg-transparent" : tagClass(app.tagColor)
                    }`}
                  >
                    {locked ? unlockTier : app.tag}
                  </span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{app.description}</p>
                {app.id === "landing-page-builder" && (
                  <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    Powered by {DIRECTION_COUNTS.total} distinct templates
                  </p>
                )}
                <div className="mt-3 text-[11px] text-[#22d3ee]/50 group-hover:text-[#22d3ee] transition-colors font-mono">
                  {locked ? `Upgrade to ${unlockTier} →` : "Open →"}
                </div>
              </GlowCard>
            );
          })}
        </div>

        {/* Run something now — without picking a card first */}
        <div className="mt-8 flex flex-col gap-2">
          <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
            Run something now
          </span>
          <StarterBox
            placeholder="Tell your agent what to run — a draft, a quote, a follow-up sweep…"
            submitLabel="Run →"
            rows={2}
            chips={[
              "Draft a proposal for the warehouse build",
              "Show me which leads have gone cold this week",
              "Write a quote for a first-time facial package",
            ]}
          />
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800/60">
          <p className="text-sm text-slate-500 leading-relaxed">
            The deeper your brain, the better the output. More work apps ship as the platform
            grows.
          </p>
        </div>

        {/* First-touch guide — what to ask, what this connects to, and a sample output */}
        <div className="mt-8">
          <TabGuide
            prompts={[
              "Drop a competitor's product launch video here — I'll log what they actually claimed",
              "Share a Russell Brunson or Hormozi clip — I'll add the techniques to your voice influences",
              "Send a customer testimonial video — I'll pull the quotes for your landing page",
              "Forward an industry update from a contractor channel — I'll summarize and roll it into your weekly brief",
            ]}
            worksWith={[
              {
                href: "/app/apps/youtube",
                label: "YouTube",
                blurb: "Drop a link or watch a channel — PA reads the video and files what matters.",
              },
              {
                href: "/app/projects",
                label: "Projects",
                blurb: "When an app's work has several steps, it runs as a plan you approve first.",
              },
              {
                href: "/app/mission-control",
                label: "Mission Control",
                blurb: "Whatever an app drafts — an email, a proposal — stages there for your approval.",
              },
            ]}
            exampleLabel="See an example output"
            exampleNote="This is a sample. Open any app above to run it against your own brain."
          >
            <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
              <div className="text-[10px] font-mono text-[#22d3ee]/60 uppercase tracking-[0.18em]">
                Follow-up Radar
              </div>
              <p className="mt-1.5 text-sm font-semibold text-slate-100">3 relationships have gone quiet</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-slate-400">
                <li className="leading-relaxed">
                  <span className="text-slate-200">Maria Delgado</span> — no contact in 6 days, decision
                  expected this week. Drafted a nudge.
                </li>
                <li className="leading-relaxed">
                  <span className="text-slate-200">The Hale wedding</span> — venue walk was Tuesday,
                  no recap sent. Drafted one.
                </li>
                <li className="leading-relaxed">
                  <span className="text-slate-200">Carter kitchen remodel</span> — quote sent 12 days
                  ago, never followed up. Drafted a check-in.
                </li>
              </ul>
              <p className="mt-3 text-[11px] font-mono text-slate-500">
                All three drafts staged in Mission Control →
              </p>
            </div>
          </TabGuide>
        </div>
      </div>
    </div>
  );
}
