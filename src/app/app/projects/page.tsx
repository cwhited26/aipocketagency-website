import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listScaffolds, type ScaffoldEntry } from "@/lib/pa-brain";
import { redirect } from "next/navigation";
import ExamplePlanPanel from "./ExamplePlanPanel";
import { WorksWithPanel } from "../_components/TabGuide";

export const dynamic = "force-dynamic";

export const metadata = { title: "Projects — Pocket Agent" };

// Starter prompts for the empty state — the kinds of multi-step asks that produce a plan.
const STARTERS = [
  "Build me a one-page landing site for [project]",
  "Follow up with the three prospects from my call list and stage drafts for me to approve",
  "Take what's in my brain about [topic] and turn it into a one-pager",
  "Plan and run a five-email drip for [audience]",
];

// "patrick-proposal" → "Patrick proposal" for a readable project label.
function deslugify(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Top-level Projects surface. Renders active scaffoldings (Wave B SPEC §9.2a) — each is a
// scaffolds/<slug>/scaffolding.md plan in the owner's brain. When there are none, shows a
// concrete empty state with starter asks. The collapsible example plan panel is always
// available so a first-time owner can see what a plan looks like before they ever run one.
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

        {/* Intro */}
        <p className="text-sm text-slate-300 leading-relaxed">
          Anytime you give your agent something with multiple steps &mdash; draft a proposal for
          the Stoll deal, follow up with three prospects, build a lead magnet &mdash; it writes a
          plan first. You see the whole plan before any of it fires. Edit what&apos;s off. Hit
          Approve. Your agent does the work and reports back here.
        </p>

        {/* Active plans, or the concrete empty state */}
        {scaffolds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/40 px-5 py-6">
            <p className="text-sm font-medium text-slate-200">
              No active projects yet. Try one of these:
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {STARTERS.map((s) => (
                <li key={s}>
                  <Link
                    href={`/app/ask?q=${encodeURIComponent(s)}`}
                    className="group flex items-start gap-3 rounded-lg border border-slate-800/50 bg-slate-950/30 px-4 py-3 hover:border-slate-700/60 hover:bg-slate-800/40 transition-all min-h-[44px]"
                  >
                    <span className="shrink-0 text-[#22d3ee]/50 mt-0.5 text-xs">→</span>
                    <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors leading-relaxed">
                      {s}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
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
              blurb: "Give your agent a multi-step ask and it writes the plan you see here.",
            },
            {
              href: "/app/apps/inbox",
              label: "Inbox",
              blurb: "Anything the plan sends or books waits there for your approval as it runs.",
            },
            {
              href: "/app/tasks",
              label: "Tasks",
              blurb: "Steps that need you — sign a contract, send a deposit — show up as your tasks.",
            },
            {
              href: "/app/apps",
              label: "Apps",
              blurb: "A workflow app can run as a plan when its work has several steps.",
            },
          ]}
        />

        {/* Example plan — always available */}
        <ExamplePlanPanel />

        {/* Footer */}
        <div className="rounded-xl border border-slate-800/40 bg-transparent px-5 py-4">
          <p className="text-[11px] font-mono text-slate-600 leading-relaxed">
            Ready to start one?{" "}
            <Link
              href="/app/ask"
              className="text-[#22d3ee]/60 hover:text-[#22d3ee] transition-colors"
            >
              Open Agent →
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
