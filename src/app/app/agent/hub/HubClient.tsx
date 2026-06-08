"use client";

import type { ConversationThread } from "@/lib/pa-conversations";
import type { ScaffoldEntry } from "@/lib/pa-brain";

// ─── Utilities ─────────────────────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

// "patrick-proposal" → "Patrick proposal" for a readable scaffold label.
function deslugify(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function HubClient({
  threads,
  scaffolds,
}: {
  threads: ConversationThread[];
  scaffolds: ScaffoldEntry[];
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-7 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Hub</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Every thread you&rsquo;ve started with your agent.
            </p>
          </div>
          <a
            href="/app/ask"
            className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors min-h-[44px]"
          >
            <span className="text-base font-bold leading-none">+</span>
            New thread
          </a>
        </div>

        {/* In-flight scaffolds — only rendered when the brain actually has some */}
        {scaffolds.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
              In-flight plans
            </span>
            <div className="flex flex-col gap-1.5">
              {scaffolds.map((s) => (
                <a
                  key={s.slug}
                  href="/app/documents"
                  className="group flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 hover:border-slate-600 hover:bg-slate-900 transition-all min-h-[56px]"
                >
                  <span className="text-[#22d3ee]/60 shrink-0 text-sm">◆</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200 group-hover:text-slate-100 truncate">
                      {deslugify(s.slug)}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 truncate">{s.path}</p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-600 group-hover:text-[#22d3ee]/70 transition-colors shrink-0">
                    View →
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Recent threads */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
            Recent threads
          </span>

          {threads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/40 px-5 py-8 text-center">
              <p className="text-sm text-slate-300">No threads yet.</p>
              <p className="text-[13px] text-slate-500 mt-1">
                Start one and it&rsquo;ll show up here so you can pick it back up anytime.
              </p>
              <a
                href="/app/ask"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-700 transition-colors min-h-[44px]"
              >
                Start your first thread →
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {threads.map((t) => (
                <a
                  key={t.id}
                  href={`/app/ask?c=${t.id}`}
                  className="group block rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3.5 hover:border-slate-600 hover:bg-slate-900 transition-all min-h-[60px]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-slate-200 group-hover:text-slate-100 truncate">
                      {t.title || "Untitled thread"}
                    </p>
                    <span className="shrink-0 text-[11px] font-mono text-slate-600">
                      {relativeTime(t.updated_at)}
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-400 mt-1 leading-relaxed line-clamp-1">
                    {t.snippet ?? "No messages yet."}
                  </p>
                </a>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
