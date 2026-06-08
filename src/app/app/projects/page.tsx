import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listProjects, type Project } from "@/lib/pa-projects";
import { redirect } from "next/navigation";
import ExamplePlanPanel from "./ExamplePlanPanel";
import { WorksWithPanel } from "../_components/TabGuide";
import { NewProjectButton } from "./_components/NewProjectButton";

export const dynamic = "force-dynamic";

export const metadata = { title: "Projects — Pocket Agent" };

// A short relative-time label for the project list ("2h ago", "3d ago").
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Top-level Projects surface. A project is both an execution unit (a goal + plan you approve before
// it runs) AND a context container — its own instructions, memory, reference files, and the
// conversations that live inside it. This page lists the owner's projects and starts new ones; the
// workspace at /app/projects/[id] is where each one is set up and run.
export default async function ProjectsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;
  if (!paUser) redirect("/app/onboarding");

  const projectsResult = await listProjects(user.id);
  const projects: Project[] = projectsResult.ok ? projectsResult.data : [];

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-5 py-7 flex flex-col gap-8">

        {/* Header */}
        <div>
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-1">
            A place to hold the work
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Projects</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            A home for everything one piece of work needs — the rules, the files, the memory, and
            the conversations.
          </p>
        </div>

        {/* Intro — execution unit AND context container */}
        <p className="text-sm text-slate-300 leading-relaxed">
          A project is two things at once. It&apos;s the work — a goal your agent breaks into a plan
          you approve before anything runs. And it&apos;s the place that holds everything the work
          needs: instructions you write once that shape every conversation in the project, reference
          files every conversation can read, memory that stays inside the project instead of
          spilling into the rest of your brain, and all the threads where the work actually happens.
          Open a project and your agent already knows the rules, the background, and where you left
          off.
        </p>

        {/* New project */}
        <NewProjectButton />

        {/* Your projects */}
        {projects.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
              Your projects
            </span>
            <ul className="flex flex-col gap-1.5">
              {projects.map((p) => (
                <li key={p.id}>
                  <a
                    href={`/app/projects/${p.id}`}
                    className="group flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3.5 hover:border-slate-600 hover:bg-slate-900 transition-all min-h-[56px]"
                  >
                    <span
                      className={`shrink-0 text-sm ${p.instructions?.trim() ? "text-emerald-400/70" : "text-amber-400/70"}`}
                      title={p.instructions?.trim() ? "Instructions set" : "Instructions not set yet"}
                    >
                      {p.instructions?.trim() ? "●" : "○"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200 group-hover:text-slate-100 truncate">
                        {p.title}
                      </p>
                      <p className="text-[12px] text-slate-500 truncate">
                        {p.goal?.trim() || "No goal set yet"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-mono text-slate-600 group-hover:text-[#22d3ee]/70 transition-colors">
                      {relativeTime(p.updated_at)} →
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
              href: "/app/mission-control",
              label: "Mission Control",
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
