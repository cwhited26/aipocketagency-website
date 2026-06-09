import { createClient } from "@/lib/supabase/server";
import { getRun, listLeadsForRun } from "@/lib/leads/runs";
import { getSource } from "@/lib/leads/source";
import { CLASSIFICATION_RANK } from "@/lib/leads/card";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import RunLeadsClient, { type LeadView } from "./RunLeadsClient";

export const dynamic = "force-dynamic";

// The run-detail page: every lead this run produced, warmest first, each with a "Draft outreach for
// this lead" button (Phase 3 single-lead path) plus a batch "Draft outreach for hot + warm" button.
export default async function LeadScoutRunPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const runResult = await getRun(params.id, user.id);
  if (!runResult.ok || !runResult.data) notFound();
  const run = runResult.data;

  const [leadsResult, sourceResult] = await Promise.all([
    listLeadsForRun(params.id, user.id),
    getSource(run.source_id, user.id),
  ]);
  const leads = leadsResult.ok ? leadsResult.data : [];
  const sourceName = sourceResult.ok && sourceResult.data ? sourceResult.data.name : "Lead Scout";

  const views: LeadView[] = leads
    .filter((l) => l.status === "extracted")
    .sort((a, b) => CLASSIFICATION_RANK[a.classification] - CLASSIFICATION_RANK[b.classification])
    .map((l) => ({
      id: l.id,
      name: l.name,
      domain: l.domain,
      url: l.url,
      summary: l.summary,
      contact: l.contact,
      classification: l.classification,
      status: l.status,
      outreachDrafted: Boolean(l.outreach_drafted_at),
    }));

  const warmHotCount = views.filter((v) => v.classification === "hot" || v.classification === "warm").length;

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-2">
          <Link
            href="/app/apps/lead-scout"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Lead Scout
          </Link>
        </div>

        <div className="mb-6">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            {sourceName}
          </div>
          <h1 className="text-2xl font-bold text-slate-100">
            {run.lead_count} {run.lead_count === 1 ? "lead" : "leads"}
          </h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            {run.breakdown.hot} hot · {run.breakdown.warm} warm · {run.breakdown.cold} cold ·{" "}
            {run.breakdown.wrong_fit} wrong-fit · {run.breakdown.needs_research} needs research.
            Draft outreach for the hot and warm ones in your voice, then Approve &amp; Send from your
            Gmail.
          </p>
          <a
            href={`/api/app/apps/lead-scout/runs/${run.id}/csv`}
            className="mt-3 inline-flex items-center text-[12px] font-mono text-[#22d3ee]/80 hover:text-[#22d3ee] transition-colors"
          >
            Download CSV ↓
          </a>
        </div>

        {views.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-10 text-center">
            <p className="text-sm text-slate-400">This run didn&apos;t extract any leads.</p>
          </div>
        ) : (
          <RunLeadsClient runId={run.id} leads={views} warmHotCount={warmHotCount} />
        )}
      </div>
    </div>
  );
}
