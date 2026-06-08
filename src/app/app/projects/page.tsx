import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listScaffolds, type ScaffoldEntry } from "@/lib/pa-brain";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// "patrick-proposal" → "Patrick proposal" for a readable project label.
function deslugify(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Top-level Projects surface. Renders active scaffoldings (Wave B SPEC §9.2a) — each is a
// scaffolds/<slug>/scaffolding.md plan in the owner's brain. Read-only list; tapping a plan
// opens Documents to read the full Project → Milestones → Tasks decomposition.
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
    <div className="h-full overflow-y-auto bg-[#05070a]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="text-[10px] text-[#22d3ee]/60 font-mono tracking-[0.2em] uppercase mb-2">
            Project scaffolding
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Projects</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            When you ask your agent for non-trivial work, it scaffolds a plan — Project →
            Milestones → Tasks — and you approve it before anything runs. Active plans live here.
          </p>
        </div>

        {scaffolds.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 px-6 py-8 text-center">
            <p className="text-sm font-semibold text-slate-100">No active project plans</p>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed max-w-md mx-auto">
              Active project plans from your agent will appear here when you ask for non-trivial
              work.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {scaffolds.map((s) => (
              <li key={s.slug}>
                <a
                  href="/app/documents"
                  className="group flex items-center gap-3 rounded-xl border border-slate-800/70 bg-slate-900/40 px-5 py-4 hover:border-slate-600 hover:bg-slate-900 transition-all"
                >
                  <span className="text-[#22d3ee]/60 shrink-0 text-sm">◆</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-100 truncate">
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
        )}
      </div>
    </div>
  );
}
