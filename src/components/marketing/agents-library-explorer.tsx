"use client";

// The /agents filter surface (PA-POS-24) — Twin-style dual taxonomy: one Industry chip row,
// one Use Case chip row, both optional, cards filter live. Data is the static library; the
// only client state is the two selected chips. The authenticated mirror at /app/agents
// (PA-POS-37) renders the SAME explorer with mode="app", which swaps every card's signup
// link for the Clone action — one grid, one filter model, the auth state changes the CTA.
import { useMemo, useState } from "react";
import { CloneAgentButton } from "@/components/agents/clone-agent-button";
import {
  AGENTS_LIBRARY,
  INDUSTRY_FILTERS,
  USE_CASE_FILTERS,
  agentFitsIndustry,
  type IndustryFilter,
  type UseCaseFilter,
} from "@/data/agents-library";
import { AgentCard } from "./agent-card";
import { MONO_FONT } from "./cta";

function ChipRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { slug: T; label: string }[];
  selected: T | null;
  onSelect: (slug: T | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="w-20 shrink-0 text-[11px] uppercase tracking-wider text-slate-500"
        style={{ fontFamily: MONO_FONT }}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
          selected === null
            ? "border-accent/60 bg-accent/10 text-accent"
            : "border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200"
        }`}
      >
        All
      </button>
      {options.map((o) => (
        <button
          key={o.slug}
          type="button"
          onClick={() => onSelect(selected === o.slug ? null : o.slug)}
          className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
            selected === o.slug
              ? "border-accent/60 bg-accent/10 text-accent"
              : "border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AgentsLibraryExplorer({ mode = "marketing" }: { mode?: "marketing" | "app" }) {
  const [industry, setIndustry] = useState<IndustryFilter | null>(null);
  const [useCase, setUseCase] = useState<UseCaseFilter | null>(null);

  const agents = useMemo(
    () =>
      AGENTS_LIBRARY.filter(
        (a) =>
          (industry === null || agentFitsIndustry(a, industry)) &&
          (useCase === null || a.useCases.includes(useCase)),
      ),
    [industry, useCase],
  );

  return (
    <div>
      <div className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <ChipRow label="industry" options={INDUSTRY_FILTERS} selected={industry} onSelect={setIndustry} />
        <ChipRow label="use case" options={USE_CASE_FILTERS} selected={useCase} onSelect={setUseCase} />
      </div>
      <p className="mt-4 text-sm text-slate-500">
        {agents.length} agent{agents.length === 1 ? "" : "s"}
        {industry || useCase ? " match your filters" : " in the library"}. Every one drafts
        first and waits for your approval.
      </p>
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => (
          <AgentCard
            key={a.slug}
            agent={a}
            cta={mode === "app" ? <CloneAgentButton agent={a} /> : undefined}
          />
        ))}
      </div>
    </div>
  );
}
