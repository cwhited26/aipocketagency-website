import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, TIER_LABELS } from "@/lib/personas/tier-caps";
import { tierAllowsLinkedinScout, tierCanSeeLinkedinScout, weeklyShortlistCap } from "@/lib/linkedin-scout/gate";
import { configuredEnrichers } from "@/lib/linkedin-scout/enrichers";
import { listProspects, listDraftsForOwner } from "@/lib/linkedin-scout/db";
import { listRituals } from "@/lib/rituals/db";
import { ENRICHMENT_SOURCE_LABELS, type EnrichmentSource } from "@/lib/linkedin-scout/types";
import { redirect } from "next/navigation";
import Link from "next/link";
import LinkedInScoutClient, { type ProspectView } from "./LinkedInScoutClient";

export const dynamic = "force-dynamic";

export default async function LinkedInScoutPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");

  const tier = await getCurrentTier(user.id);
  const unlocked = tierAllowsLinkedinScout(tier);
  const canSee = tierCanSeeLinkedinScout(tier);

  const configuredSources = configuredEnrichers().map((e) => e.source);
  const cap = weeklyShortlistCap(tier);

  const [prospectsRes, draftsRes, ritualsRes] = await Promise.all([
    listProspects(user.id),
    listDraftsForOwner(user.id),
    listRituals(user.id),
  ]);
  const prospectRows = prospectsRes.ok ? prospectsRes.data : [];
  const drafts = draftsRes.ok ? draftsRes.data : [];
  const rituals = (ritualsRes.ok ? ritualsRes.data : []).filter((r) => r.app_slug === "linkedin-scout");

  const draftsByProspect = new Map<string, typeof drafts>();
  for (const d of drafts) {
    const list = draftsByProspect.get(d.prospect_id) ?? [];
    list.push(d);
    draftsByProspect.set(d.prospect_id, list);
  }

  const prospects: ProspectView[] = prospectRows.map((p) => ({
    id: p.id,
    linkedinProfileUrl: p.linkedin_profile_url,
    fullName: p.full_name,
    headline: p.headline,
    company: p.company,
    fitScore: p.fit_score,
    enrichmentSource: p.enrichment_source,
    brief: p.brief,
    connectionStatus: p.connection_status,
    day3InmailStatus: p.day3_inmail_status,
    day7FollowupStatus: p.day7_followup_status,
    drafts: (draftsByProspect.get(p.id) ?? []).map((d) => ({
      id: d.id,
      kind: d.kind,
      body: d.body,
      voiceFlags: d.voice_flags,
      executedAt: d.executed_at,
    })),
  }));

  const ritualViews = rituals.map((r) => ({
    id: r.id,
    name: r.name,
    scheduleText: r.schedule_natural_text,
    enabled: r.enabled,
    lastRunAt: r.last_run_at,
    lastRunStatus: r.last_run_status,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-500">
          <Link href="/app/apps" className="hover:text-slate-300">
            Apps
          </Link>
          <span>/</span>
          <span className="text-slate-300">LinkedIn Scout</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">LinkedIn Scout</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Search LinkedIn by your ideal customer, let PA research each match through the paid data you
          already pay for, and stage the outreach — one approval card per send. PA never scrapes; the
          click happens on your own logged-in tab, at human speed.
        </p>
      </header>

      {!unlocked ? (
        <LockedNotice tierLabel={TIER_LABELS[tier]} canSee={canSee} />
      ) : (
        <LinkedInScoutClient
          initialProspects={prospects}
          rituals={ritualViews}
          configuredSources={configuredSources as EnrichmentSource[]}
          sourceLabels={ENRICHMENT_SOURCE_LABELS}
          weeklyCap={cap}
          tierLabel={TIER_LABELS[tier]}
        />
      )}
    </div>
  );
}

function LockedNotice({ tierLabel, canSee }: { tierLabel: string; canSee: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <p className="text-sm text-slate-300">
        LinkedIn Scout unlocks on <span className="font-semibold text-slate-100">Pro+</span>. You&rsquo;re
        on {tierLabel}.
      </p>
      <p className="mt-2 text-sm text-slate-400">
        {canSee
          ? "Upgrade to research LinkedIn prospects and stage the outreach for one-tap approval — with a weekly cap that scales up your plan."
          : "Pro+ and up can research LinkedIn prospects, draft the outreach in your voice, and approve each send one card at a time."}
      </p>
      <Link
        href="/pricing"
        className="mt-4 inline-flex items-center rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-[#67e8f9]"
      >
        See plans
      </Link>
    </div>
  );
}
