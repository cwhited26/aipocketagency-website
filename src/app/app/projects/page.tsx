import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listScaffolds, type ScaffoldEntry } from "@/lib/pa-brain";
import { redirect } from "next/navigation";
import ExamplePlanPanel from "./ExamplePlanPanel";
import { WorksWithPanel } from "../_components/TabGuide";
import { StarterBox } from "../_components/StarterBox";

export const dynamic = "force-dynamic";

export const metadata = { title: "Projects — Pocket Agent" };

// Multi-step jobs the agent can run across the tools it's already connected to. These pre-fill the
// "Tell me what you want done" box so the owner can edit and start without leaving the tab. Every
// one is honest to today's surface — Gmail / Calendar / Slack / QuickBooks / Stripe / Calendly /
// Zoom and the brain. No whole-system builds (no CRM, no website, no dashboard) — those are queued
// for the build connector pack, called out in the "What's planned next" panel below.
const STARTERS = [
  "Draft a five-touch follow-up sequence for the three prospects from my discovery calls this week",
  "Pull every Stripe invoice and Gmail thread from last month and write me a weekly client revenue brief to my brain",
  "Schedule a Zoom call with a prospect next Tuesday — find a 30-minute slot, draft the invite, send the Calendly confirmation",
  "Coordinate a monthly newsletter: pull what's in my brain about my latest work, draft three section variations, stage it as a Gmail draft for me",
  "Run a follow-up sweep — find every prospect I haven't contacted in 14 days, draft a nudge in my voice for each, stage them in my approval inbox",
];

// "prospect-followup-sweep" → "Prospect followup sweep" for a readable project label.
function deslugify(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Top-level Projects surface. Renders active plans — each is a plan in the owner's brain. The
// "Tell me what you want done" box starts a new one in place; the collapsible example shows what a
// real multi-step plan looks like before the owner ever runs one.
export default async function ProjectsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;
  if (!paUser) redirect("/app/onboarding");

  let scaffolds: ScaffoldEntry[] = [];
  if (paUser.brain_repo) {
    scaffolds = await listScaffolds(paUser.brain_repo, paUser.github_token);
  }

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-5 py-7 flex flex-col gap-8">

        {/* Header */}
        <div>
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-1">
            Plan before it runs
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Projects</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Big asks broken down so you can approve before they run.
          </p>
        </div>

        {/* Intro — multi-step work across the tools your agent already has connected */}
        <p className="text-sm text-slate-300 leading-relaxed">
          Projects is where your agent takes on multi-step work across the tools it&apos;s already
          connected to. Drip campaigns. Follow-up sweeps. Coordinated outreach. Reporting workflows.
          Anything that&apos;s more than one step and touches Gmail, Calendar, Slack, QuickBooks,
          Stripe, Calendly, Zoom, or your brain. The agent reads your brain&apos;s rulebook — your
          conventions, your voice, your decisions — and writes a full plan first. You see every
          milestone and every task before any of it fires. You approve. It runs.
        </p>

        {/* Start a project — act without leaving the tab */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
            Start a project
          </span>
          <StarterBox
            placeholder="Tell me what you want done…"
            submitLabel="Start project →"
            chips={STARTERS}
          />
        </div>

        {/* Active plans */}
        {scaffolds.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
              Active plans
            </span>
            <ul className="flex flex-col gap-1.5">
              {scaffolds.map((s) => (
                <li key={s.slug}>
                  <a
                    href="/app/documents"
                    className="group flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3.5 hover:border-slate-600 hover:bg-slate-900 transition-all min-h-[56px]"
                  >
                    <span className="text-[#22d3ee]/60 shrink-0 text-sm">◆</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200 group-hover:text-slate-100 truncate">
                        {deslugify(s.slug)}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 truncate">{s.path}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-mono text-slate-600 group-hover:text-[#22d3ee]/70 transition-colors">
                      View plan →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Works with — the tabs a project touches */}
        <WorksWithPanel
          items={[
            {
              href: "/app/ask",
              label: "Agent",
              blurb: "Give your agent a big ask and it writes the plan you approve here.",
            },
            {
              href: "/app/apps/inbox",
              label: "Inbox",
              blurb: "Anything the project sends or books waits there for your approval as it runs.",
            },
            {
              href: "/app/brain",
              label: "Brain",
              blurb: "Your conventions, voice, and decisions are the rulebook your agent works inside.",
            },
            {
              href: "/app/settings/connections",
              label: "Connections",
              blurb: "A project runs across the tools you've connected — Gmail, Calendar, QuickBooks, Stripe, Slack.",
            },
          ]}
        />

        {/* Example plan — always available */}
        <ExamplePlanPanel />

        {/* What's planned next — honest about the build-tools roadmap, no dates */}
        <div className="rounded-xl border border-dashed border-slate-700/70 bg-slate-900/30 px-5 py-4">
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-[0.14em] mb-1.5">
            What&apos;s planned next
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Today, projects run across the tools your agent is already connected to. Bigger builds —
            spinning up new repos, deploying websites, provisioning databases — aren&apos;t here yet.
            That arrives when the build connector pack ships.
          </p>
        </div>

      </div>
    </div>
  );
}
