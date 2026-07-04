// /app/agents — the authenticated mirror of the marketing /agents Library (PA-POS-37).
// Same slug, two subdomains, two adjacent purposes: pocketagent.com/agents sells the shelf
// to anonymous traffic; this page IS the shelf inside the workspace. The two surfaces share
// the compose card, the 30 library cards, and the filter model — the auth state changes the
// CTAs. Compose here runs the real flow (PA-POS-27/34): POST /api/app/agent-builder/compose,
// one approval card in Mission Control. Clone on a card feeds the card's workflow through the
// SAME flow. Below the grid: this owner's pa_agent_builds, grouped by where they stand.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AgentsCompose } from "@/components/marketing/agents-compose";
import { AgentsLibraryExplorer } from "@/components/marketing/agents-library-explorer";
import { buildComposeData } from "@/lib/marketing/compose-preview-data";
import { AGENTS_LIBRARY } from "@/data/agents-library";
import { listAgentBuilds } from "@/lib/agent-builder/db";
import { listPersonasForBusiness } from "@/lib/personas/db";
import { agentBuilderLog } from "@/lib/agent-builder/log";
import type { AgentBuildRow } from "@/lib/agent-builder/types";

export const metadata = { title: "Agents — Pocket Agent" };

function buildDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function BuildLine({
  build,
  action,
}: {
  build: AgentBuildRow;
  action: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-[14px] leading-snug text-slate-200">{build.spec_text}</p>
        <p className="mt-1 text-[12px] text-slate-500">
          {buildDate(build.created_at)}
          {build.composed_apps.length > 0 &&
            ` · ${build.composed_apps.length} App${build.composed_apps.length === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}

export default async function AppAgentsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const composeData = buildComposeData();

  const [buildsResult, personas] = await Promise.all([
    listAgentBuilds(user.id),
    listPersonasForBusiness(user.id).catch((e: unknown) => {
      agentBuilderLog.warn("personas lookup failed on /app/agents", {
        ownerId: user.id,
        error: e instanceof Error ? e.message : String(e),
      });
      return [];
    }),
  ]);

  if (!buildsResult.ok) {
    agentBuilderLog.warn("builds list failed on /app/agents", {
      ownerId: user.id,
      status: buildsResult.status,
      error: buildsResult.error,
    });
  }
  const builds = buildsResult.ok ? buildsResult.data : [];
  const personaIdBySlug = new Map(personas.map((p) => [p.slug, p.id]));

  const awaiting = builds.filter((b) => b.status === "awaiting_approval");
  const approved = builds.filter((b) => b.status === "approved");
  const rejected = builds.filter((b) => b.status === "rejected");
  const hasBuilds = awaiting.length + approved.length + rejected.length > 0;

  const linkClass =
    "rounded-lg border border-accent/40 bg-accent/[0.06] px-3.5 py-2 text-[13px] font-semibold text-accent transition hover:border-accent hover:bg-accent/[0.12]";

  return (
    <div className="mx-auto max-w-6xl px-6 pb-20">
      <section className="pt-10 sm:pt-14">
        <p className="text-xs uppercase tracking-[0.2em] text-accent/80">The Agents Library</p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          The agent you need isn&apos;t on the shelf? Describe it.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-400">
          The same {AGENTS_LIBRARY.length} agents as the public library — but in here, Compose
          and Clone stage a real agent in Mission Control, built from your Personas, Apps, and
          Skills. Every composed agent waits for your approval before it runs. Nothing sends
          without you.
        </p>
      </section>

      {/* The create surface — the same compose card as /agents#compose (PA-POS-34), running
          the real flow from the first render because this page sits behind the app auth gate. */}
      <section id="compose" className="mt-8 scroll-mt-24">
        <article
          data-agent-card="custom-agent-builder"
          className="rounded-2xl border border-accent/25 bg-accent/[0.04] p-6 sm:p-8"
        >
          <div className="max-w-2xl">
            <span className="rounded-full border border-accent/30 bg-accent/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-wider text-accent">
              Custom Agent Builder
            </span>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
              Describe the agent you need — Pocket Agent composes it from the same Personas,
              Apps, and Skills every agent on this page is built from, and stages it for your
              approval before it runs. The agent lives in your Business Brain repo. Not our
              database.
            </p>
          </div>
          <div className="mt-5">
            <AgentsCompose composeData={composeData} initialSignedIn />
          </div>
        </article>
      </section>

      <section className="mt-10">
        <AgentsLibraryExplorer mode="app" />
      </section>

      <section data-agent-builds className="mt-14 border-t border-white/5 pt-10">
        <h2 className="text-xl font-semibold tracking-tight">Your composed agents</h2>

        {!buildsResult.ok && (
          <p className="mt-4 text-sm leading-relaxed text-red-400">
            Couldn&apos;t load your composed agents. Refresh to retry.
          </p>
        )}

        {buildsResult.ok && !hasBuilds && (
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            No composed agents yet — describe one above.
          </p>
        )}

        {awaiting.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[11px] uppercase tracking-wider text-amber-200/80">
              Waiting on your approval
            </h3>
            <ul className="mt-3 space-y-2.5">
              {awaiting.map((b) => (
                <BuildLine
                  key={b.id}
                  build={b}
                  action={
                    <Link href="/app/mission-control" className={linkClass}>
                      Review in Mission Control
                    </Link>
                  }
                />
              ))}
            </ul>
          </div>
        )}

        {approved.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[11px] uppercase tracking-wider text-emerald-200/80">
              Approved and live
            </h3>
            <ul className="mt-3 space-y-2.5">
              {approved.map((b) => {
                const personaId = b.composed_persona_slug
                  ? personaIdBySlug.get(b.composed_persona_slug)
                  : undefined;
                return (
                  <BuildLine
                    key={b.id}
                    build={b}
                    action={
                      <Link
                        href={personaId ? `/app/personas/${personaId}` : "/app/personas"}
                        className={linkClass}
                      >
                        Open the Persona
                      </Link>
                    }
                  />
                );
              })}
            </ul>
          </div>
        )}

        {rejected.length > 0 && (
          <details className="mt-6 group">
            <summary className="cursor-pointer list-none text-[11px] uppercase tracking-wider text-slate-500 transition hover:text-slate-300">
              <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">
                ▸
              </span>
              Rejected ({rejected.length})
            </summary>
            <ul className="mt-3 space-y-2.5">
              {rejected.map((b) => (
                <BuildLine
                  key={b.id}
                  build={b}
                  action={<span className="text-[12px] text-slate-500">Nothing was deployed</span>}
                />
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
