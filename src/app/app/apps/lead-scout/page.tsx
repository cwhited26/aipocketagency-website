import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchLeadScoutConnectionPublic } from "@/lib/pa-lead-scout-connections";
import { listSources } from "@/lib/leads/source";
import { listRunsForSource } from "@/lib/leads/runs";
import { redirect } from "next/navigation";
import Link from "next/link";
import LeadScoutClient, { type SourceView } from "./LeadScoutClient";

export const dynamic = "force-dynamic";

// Use cases from the SPEC — Phases 1 + 2 + 3 are live (find → sort → draft the outreach).
const USE_CASES: { phase: string; live: boolean; title: string; body: string }[] = [
  {
    phase: "Live now",
    live: true,
    title: "Sweep Google Maps",
    body: "Pick a category and a place — \"roofers within 25 miles of Knoxville without a website\" — and PA builds the list itself, the sites-needed businesses to pitch.",
  },
  {
    phase: "Live now",
    live: true,
    title: "Paste a list of URLs",
    body: "Drop in a list of links — directory pages, a saved search, a spreadsheet column. PA visits each one and pulls back a structured profile.",
  },
  {
    phase: "Live now",
    live: true,
    title: "Draft the outreach",
    body: "PA writes a first email to each hot + warm lead in your voice and stages it for your tap — Approve & Send from your Gmail. Set a daily or weekly schedule and the leads + drafts keep coming.",
  },
];

export default async function LeadScoutPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");
  const paUser = paResult.data;

  const [connResult, sourcesResult] = await Promise.all([
    fetchLeadScoutConnectionPublic(user.id),
    listSources(user.id),
  ]);
  const connected = connResult.ok && connResult.data?.status === "active";
  const sources = sourcesResult.ok ? sourcesResult.data : [];

  // Attach each source's most recent run so the row can show "N leads · last run Xh ago".
  const views: SourceView[] = await Promise.all(
    sources.map(async (s): Promise<SourceView> => {
      const runs = await listRunsForSource(s.id, user.id);
      const last = runs.ok ? runs.data[0] ?? null : null;
      const detail =
        s.kind === "google_maps" && s.config_json
          ? `${s.config_json.category} · ${s.config_json.location}`
          : `${s.seed_urls.length} ${s.seed_urls.length === 1 ? "URL" : "URLs"}`;
      return {
        id: s.id,
        name: s.name,
        kind: s.kind,
        schedule: s.schedule,
        projectId: s.project_id,
        detail,
        lastRun: last
          ? { id: last.id, createdAt: last.created_at, leadCount: last.lead_count, status: last.status }
          : null,
      };
    }),
  );

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
            Your agent finds leads
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Lead Scout</h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Sweep Google Maps for a category in a place — &ldquo;roofers near Knoxville without a
            website&rdquo; — and PA builds the list itself, the sites-needed businesses worth a pitch.
            Or paste your own URLs. Either way it pulls who they are and how to reach them, sorts them
            by fit, drafts a first email to the hot and warm ones in your voice, and stages each for
            your tap — read a few, then Approve &amp; Send from your Gmail.
          </p>
        </div>

        <Link
          href="/app/apps/lead-scout/packs"
          className="block mb-8 rounded-2xl border border-[#22d3ee]/30 bg-[#22d3ee]/[0.07] px-5 py-4 hover:border-[#22d3ee]/50 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#22d3ee]/80 mb-1">
                New — vertical packs
              </p>
              <p className="text-sm font-semibold text-slate-100">
                Subscribe to a pack and PA runs the whole loop for you
              </p>
              <p className="text-[13px] text-slate-400 mt-1 leading-relaxed">
                Roofing, HVAC, painting, general contracting, med spa, law firm, dentist — pick your
                trade and a place. The right category, the right filters, and outreach tuned to that
                vertical, all dialed in. One tap. <span className="text-slate-500">Studio+</span>
              </p>
            </div>
            <span className="shrink-0 text-[#22d3ee] text-sm font-mono">Browse →</span>
          </div>
        </Link>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {USE_CASES.map((u) => (
            <div
              key={u.title}
              className={`rounded-xl border px-4 py-4 ${
                u.live ? "border-[#22d3ee]/25 bg-[#22d3ee]/5" : "border-slate-800/60 bg-slate-900/40"
              }`}
            >
              <div
                className={`text-[10px] font-mono uppercase tracking-[0.14em] mb-1.5 ${
                  u.live ? "text-[#22d3ee]/70" : "text-slate-600"
                }`}
              >
                {u.phase}
              </div>
              <p className="text-sm font-semibold text-slate-100">{u.title}</p>
              <p className="text-[13px] text-slate-400 mt-1 leading-relaxed">{u.body}</p>
            </div>
          ))}
        </div>

        {!connected && (
          <div className="mb-6 rounded-xl border border-amber-500/25 bg-amber-500/5 px-5 py-4">
            <p className="text-sm font-semibold text-slate-100">Connect Bright Data to run a source</p>
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">
              Lead Scout visits pages through Bright Data so it can read sites that block a plain
              fetch. Add your key in{" "}
              <Link href="/app/settings/connections" className="text-[#22d3ee] hover:underline">
                Settings → Connections
              </Link>
              . You can set up a source now and run it once you&apos;re connected.
            </p>
          </div>
        )}

        {!paUser.anthropic_api_key && (
          <div className="mb-6 rounded-xl border border-slate-700/60 bg-slate-900/60 px-5 py-4">
            <p className="text-sm font-semibold text-slate-100">Add your Anthropic API key</p>
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">
              PA reads each page with your key.{" "}
              <Link href="/app/settings" className="text-[#22d3ee] hover:underline">
                Go to Settings →
              </Link>
            </p>
          </div>
        )}

        <LeadScoutClient sources={views} connected={connected} />
      </div>
    </div>
  );
}
