"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IDEA_ENGINE } from "@/lib/copy/in-app";

export type IdeaListItem = {
  slug: string;
  title: string;
  source: string;
  status: string;
  currentStage: number;
  updatedAt: string;
};

const SOURCE_LABEL: Record<string, string> = { typed: "Typed", voice: "Voice memo", share: "Shared link" };

function stageLabel(n: number): string {
  const names = ["Capture", "Market validation", "MVP blueprint", "Build", "Sales surface", "Launch"];
  return names[Math.min(Math.max(n, 1), 6) - 1];
}

export function IdeaEngineClient({ ideas, hasApiKey }: { ideas: IdeaListItem[]; hasApiKey: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = ideas.filter((i) => i.status !== "archived");
  const archived = ideas.filter((i) => i.status === "archived");

  async function drop() {
    if (title.trim().length < 2) {
      setError("Give your idea a title.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/app/apps/idea-engine/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), detail: detail.trim(), source: "typed" }),
      });
      const body = (await res.json().catch(() => ({}))) as { idea?: { slug: string }; error?: string };
      if (!res.ok || !body.idea) {
        setError(body.error ?? "Could not drop the idea.");
        return;
      }
      router.push(`/app/apps/idea-engine/${body.idea.slug}`);
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Drop an idea */}
      <section className="rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/[0.04] px-5 py-5">
        <h2 className="text-sm font-semibold text-slate-100">{IDEA_ENGINE.empty.headline}</h2>
        <p className="text-[12px] text-slate-400 mt-1">
          {IDEA_ENGINE.empty.subheadline}
        </p>
        {!hasApiKey && (
          <p className="text-[12px] text-amber-300/80 mt-3">
            Add your Anthropic API key in Settings to run the stages. You can still drop the idea now.
          </p>
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's the idea? (e.g. AI tutoring app for kids learning Spanish)"
          className="mt-3 w-full rounded-lg bg-[#0b0f14] border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee]/50 focus:outline-none"
        />
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Anything you were thinking — what it does, who it's for, what sparked it."
          rows={3}
          className="mt-2 w-full rounded-lg bg-[#0b0f14] border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee]/50 focus:outline-none resize-none"
        />
        {error && <p className="text-[12px] text-rose-400 mt-2">{error}</p>}
        <button
          onClick={drop}
          disabled={submitting}
          className="mt-3 rounded-lg bg-[#22d3ee] text-[#06080b] text-sm font-semibold px-4 py-2 hover:bg-[#22d3ee]/90 disabled:opacity-50"
        >
          {submitting ? "Opening…" : IDEA_ENGINE.empty.cta}
        </button>
      </section>

      {/* Active ideas */}
      <section>
        <h2 className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold mb-3">
          Your ideas
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-slate-500">{IDEA_ENGINE.empty.subheadline}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {active.map((i) => (
              <Link
                key={i.slug}
                href={`/app/apps/idea-engine/${i.slug}`}
                className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 hover:border-[#22d3ee]/30 transition-colors group"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-100">{i.title}</span>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">{SOURCE_LABEL[i.source] ?? i.source}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6].map((s) => (
                      <span
                        key={s}
                        className={`h-1.5 w-6 rounded-full ${s <= i.currentStage ? "bg-[#22d3ee]/70" : "bg-slate-700"}`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Stage {i.currentStage}/6 — {stageLabel(i.currentStage)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Archived */}
      {archived.length > 0 && (
        <section>
          <h2 className="text-[11px] font-mono text-slate-500 tracking-[0.14em] uppercase font-semibold mb-3">
            Archived
          </h2>
          <div className="flex flex-col gap-2">
            {archived.map((i) => (
              <Link
                key={i.slug}
                href={`/app/apps/idea-engine/${i.slug}`}
                className="rounded-xl border border-slate-800/60 bg-slate-900/20 px-4 py-3 hover:border-slate-700 transition-colors"
              >
                <span className="text-sm text-slate-400">{i.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
