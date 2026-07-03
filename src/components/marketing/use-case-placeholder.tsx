import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "./site-nav";
import { PrimaryCTA, SecondaryCTA } from "./cta";
import { AgentCard } from "./agent-card";
import { agentsForUseCase } from "@/data/agents-library";
import { getUseCase, otherUseCases, type UseCaseSlug } from "@/data/use-cases";

// Doorway shell for the use-case pages that haven't gotten their full build yet
// (PA-POS-25). Real structure — hero, an agents rail, cross-links — with the Agents
// Library carrying the depth until each page's dedicated copy lands.
export function UseCasePlaceholder({
  slug,
  children,
}: {
  slug: UseCaseSlug;
  children?: ReactNode;
}) {
  const useCase = getUseCase(slug);
  if (!useCase) return null;
  // Every UseCaseSlug is also a library UseCaseFilter; "support" exists only as a filter.
  const agents = agentsForUseCase(slug, 3);
  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-6 pb-14 pt-16 sm:pt-24">
          <p className="text-xs uppercase tracking-[0.2em] text-accent/80">
            Use case · {useCase.label}
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {useCase.h1}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
            {useCase.hook}. This page is short on purpose — the agents that do this work
            are already in the library, ready to run today.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryCTA href="/start?tier=starter" label="Start for $37" />
            <SecondaryCTA href="/agents" label="Browse the full agent library" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            Agents already doing this work
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => (
              <AgentCard key={a.slug} agent={a} />
            ))}
          </div>
        </section>

        {children}

        <section className="border-t border-white/5 bg-black/30">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-6 py-16">
            <h2 className="text-xl font-semibold tracking-tight">Other use cases</h2>
            <div className="flex flex-wrap gap-2">
              {otherUseCases(slug).map((u) => (
                <Link
                  key={u.slug}
                  href={`/use-cases/${u.slug}`}
                  className="rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] text-slate-400 transition hover:border-accent/40 hover:text-accent"
                >
                  {u.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
