"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TabGuide } from "../_components/TabGuide";
import { personaApps, type PersonaRow } from "@/lib/personas/types";
import { appsByIds } from "@/lib/apps/catalog";

type CatalogResponse = {
  personas: PersonaRow[];
  tierLabel: string;
  personaLimit: number | null;
  canCreate: boolean;
};

const STATUS_STYLE: Record<string, string> = {
  active: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  draft: "text-slate-400 border-slate-600/50 bg-slate-700/20",
  paused: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  archived: "text-slate-500 border-slate-700/50 bg-slate-800/20",
};

export default function PersonasCatalogClient() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/personas")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed to load");
        return r.json() as Promise<CatalogResponse>;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function copyShareLink(id: string) {
    const res = await fetch(`/api/personas/${id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = (await res.json().catch(() => ({}))) as { chatUrl?: string; error?: string };
    if (res.ok && body.chatUrl) {
      await navigator.clipboard.writeText(body.chatUrl).catch(() => {});
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    }
  }

  const personas = data?.personas ?? [];
  const canCreate = data?.canCreate ?? true;
  const limit = data?.personaLimit ?? null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-5 py-8">
        <header className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Personas</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Versions of your agent with their own voice and focus.
            </p>
          </div>
          {canCreate ? (
            <Link
              href="/app/personas/new"
              className="shrink-0 rounded-lg bg-[#22d3ee] text-[#06222a] text-sm font-semibold px-4 py-2.5 hover:bg-[#67e8f9] transition-colors"
            >
              New persona
            </Link>
          ) : (
            <div className="shrink-0 text-right">
              <button
                disabled
                className="rounded-lg bg-slate-800 text-slate-500 text-sm font-semibold px-4 py-2.5 cursor-not-allowed"
              >
                New persona
              </button>
              <p className="text-[11px] text-amber-400/80 mt-1.5 max-w-[180px]">
                You&apos;re using all {limit} personas on {data?.tierLabel}. Upgrade for more.
              </p>
            </div>
          )}
        </header>

        <p className="text-sm text-slate-300 leading-relaxed max-w-2xl mb-4">
          A persona is the <span className="text-slate-100">who</span> — an Admin Assistant, a Sales
          Assistant, a Content Creator, an Operations Chief of Staff. Apps are the{" "}
          <span className="text-slate-100">what</span> they use: the Email Drafter, the Follow-up Radar,
          Lead Scout. Each persona declares which Apps it can reach, writes in its own voice, and draws
          from its own slice of your brain — so your sales persona isn&apos;t answering refund questions and
          your support persona isn&apos;t cold-pitching. Start from a template, pick its Apps, share a link
          with a teammate, and it only ever knows what you&apos;ve taught it. (Soon you&apos;ll be able to
          keep separate brains for separate businesses, each with its own personas.)
        </p>

        {/* Start a persona — common types, one tap to the builder */}
        <div className="flex flex-wrap gap-2 mb-8">
          {["Sales", "Support", "Recruiting", "Content"].map((t) => (
            <Link
              key={t}
              href={`/app/personas/new?type=${t.toLowerCase()}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-sm text-slate-300 hover:border-[#22d3ee]/50 hover:text-slate-100 transition-all min-h-[40px]"
            >
              <span className="text-[#22d3ee] font-bold leading-none">+</span>
              {t} persona
            </Link>
          ))}
        </div>

        {loading && <p className="text-slate-500 text-sm">Loading…</p>}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && personas.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-10 text-center">
            <p className="text-slate-300 font-medium">No personas yet</p>
            <p className="text-slate-500 text-sm mt-1 mb-5 max-w-md mx-auto">
              Spin up a Virtual Sales Manager, Customer Service Agent, and more from a
              template in under 10 minutes.
            </p>
            <Link
              href="/app/personas/new"
              className="inline-block rounded-lg bg-[#22d3ee] text-[#06222a] text-sm font-semibold px-4 py-2.5 hover:bg-[#67e8f9] transition-colors"
            >
              Create your first persona
            </Link>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {personas.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <Link href={`/app/personas/${p.id}`} className="min-w-0">
                  <h3 className="text-slate-100 font-medium truncate hover:text-[#22d3ee] transition-colors">
                    {p.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide mt-0.5">
                    {p.template_key}
                  </p>
                </Link>
                <span
                  className={`shrink-0 text-[10px] font-mono uppercase tracking-wider border rounded px-1.5 py-0.5 ${STATUS_STYLE[p.status] ?? STATUS_STYLE.draft}`}
                >
                  {p.status}
                </span>
              </div>
              {appsByIds(personaApps(p)).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {appsByIds(personaApps(p)).map((a) => (
                    <span
                      key={a.id}
                      className="text-[10px] text-slate-400 border border-slate-700/60 rounded px-1.5 py-0.5"
                    >
                      {a.shortLabel}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Link
                  href={`/app/personas/${p.id}`}
                  className="text-xs rounded-md border border-slate-700 text-slate-300 px-3 py-1.5 hover:bg-slate-800 transition-colors"
                >
                  Open
                </Link>
                <button
                  onClick={() => copyShareLink(p.id)}
                  className="text-xs rounded-md border border-slate-700 text-slate-300 px-3 py-1.5 hover:bg-slate-800 transition-colors"
                >
                  {copied === p.id ? "Link copied!" : "Share link"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* First-touch guide — what to ask, what this connects to, and sample voices */}
        <div className="mt-10 max-w-2xl">
          <TabGuide
            promptsHeading="Try one of these"
            prompts={[
              "Ask my Sales persona to draft a cold outreach to a regional homebuilder",
              "Make a Support persona for handling refund questions",
              "Have my Sales persona write a follow-up in a closer's voice",
            ]}
            worksWith={[
              {
                href: "/app/ask",
                label: "Agent",
                blurb: "Point any chat at a persona to get its voice instead of your default agent.",
              },
              {
                href: "/app/brain",
                label: "Brain",
                blurb: "Each persona reads its own zone of your brain — sales facts, support facts, and so on.",
              },
              {
                href: "/app/email",
                label: "Email",
                blurb: "Let different personas draft replies in different voices for different threads.",
              },
            ]}
            exampleLabel="See an example of two voices"
            exampleNote="This is a sample. Create a persona above to start drafting in a specific voice."
          >
            <div className="flex flex-col gap-2">
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
                <div className="text-[10px] font-mono text-[#22d3ee]/60 uppercase tracking-[0.16em]">
                  Sales persona — closer
                </div>
                <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">
                  &ldquo;Morning — the scope&apos;s locked and the timeline works on your end. Want me to
                  send the final today so your crew can start Monday?&rdquo;
                </p>
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
                <div className="text-[10px] font-mono text-violet-300/70 uppercase tracking-[0.16em]">
                  Support persona — operator
                </div>
                <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">
                  &ldquo;Happy to help sort the refund. I see the charge from June 2 — I&apos;ll get that back
                  to your card within a few business days and send confirmation when it&apos;s done.&rdquo;
                </p>
              </div>
            </div>
          </TabGuide>
        </div>
      </div>
    </div>
  );
}
