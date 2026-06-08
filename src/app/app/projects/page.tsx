import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listScaffolds, type ScaffoldEntry } from "@/lib/pa-brain";
import { redirect } from "next/navigation";
import ExamplePlanPanel from "./ExamplePlanPanel";
import { WorksWithPanel } from "../_components/TabGuide";
import { StarterBox } from "../_components/StarterBox";

export const dynamic = "force-dynamic";

export const metadata = { title: "Projects — Pocket Agent" };

// System-level builds the agent can take on. These pre-fill the "Tell me what to build" box so the
// owner can edit and start without leaving the tab. Invented scenarios across industries — no real
// customer names — so the breadth is obvious.
const STARTERS = [
  "Build me a CRM tailored to how I run my contracting business",
  "Build a full lead-capture website for my med-spa with the brand identity in my brain",
  "Wire up an automation that creates a QuickBooks invoice every time I mark a job complete",
  "Stand up a five-touch email + SMS drip for prospects who are still deciding",
  "Build an internal dashboard that shows every active deal in one view",
];

// "kitchen-remodel-crm" → "Kitchen remodel crm" for a readable project label.
function deslugify(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Top-level Projects surface. Renders active build plans — each is a plan in the owner's brain.
// The "Tell me what to build" box starts a new one in place; the collapsible example shows what a
// real system-level plan looks like before the owner ever runs one.
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
            Whole-system builds, planned out and approved before anything runs.
          </p>
        </div>

        {/* Intro — the full story: system-scale, built inside your rules */}
        <p className="text-sm text-slate-300 leading-relaxed">
          Projects is where your agent takes on big work — whole systems, not paragraphs. Ask for a
          CRM tailored to how you run your business, a lead-capture website deployed live, an
          automation that connects your email to your accounting, a multi-channel drip across email
          and text, a custom internal dashboard. Your agent reads your brain&apos;s rulebook — your
          conventions, your voice, your decisions, what you&apos;ve tried and what you&apos;ve ruled
          out — and writes a full build plan first. You see every milestone and every task before
          any of it fires. Edit anything that&apos;s off. Hit Approve. It builds inside <em>your</em>{" "}
          rules, not some generic best-practice mush, and reports back here as each milestone lands.
        </p>

        {/* Start a build — act without leaving the tab */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
            Start a build
          </span>
          <StarterBox
            placeholder="Tell me what to build…"
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
              blurb: "Anything the build sends or books waits there for your approval as it runs.",
            },
            {
              href: "/app/brain",
              label: "Brain",
              blurb: "Your conventions, voice, and decisions are the rulebook your agent builds inside.",
            },
            {
              href: "/app/settings/connections",
              label: "Connections",
              blurb: "A build can wire up the tools you've connected — Gmail, QuickBooks, Slack.",
            },
          ]}
        />

        {/* Example plan — always available */}
        <ExamplePlanPanel />

      </div>
    </div>
  );
}
