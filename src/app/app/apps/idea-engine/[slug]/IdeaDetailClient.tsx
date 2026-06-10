"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IdeaView, StageView } from "@/lib/idea-engine/types";

const STATUS_COPY: Record<string, { label: string; cls: string }> = {
  not_started: { label: "Not started", cls: "text-slate-500 border-slate-700" },
  queued: { label: "Queued", cls: "text-slate-400 border-slate-700" },
  running: { label: "Running", cls: "text-amber-300 border-amber-500/30" },
  staged: { label: "Awaiting your approval", cls: "text-[#22d3ee] border-[#22d3ee]/40" },
  approved: { label: "Approved", cls: "text-emerald-300 border-emerald-500/30" },
  rejected: { label: "Rejected", cls: "text-rose-400 border-rose-500/30" },
  complete: { label: "Complete", cls: "text-emerald-300 border-emerald-500/30" },
  error: { label: "Error", cls: "text-rose-400 border-rose-500/30" },
};

export function IdeaDetailClient({
  idea,
  autoBuild,
  hasApiKey,
}: {
  idea: IdeaView;
  autoBuild: boolean;
  hasApiKey: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runStage(stage: number) {
    setBusy(stage);
    setError(null);
    try {
      const res = await fetch(`/api/app/apps/idea-engine/ideas/${idea.id}/run-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(body.error ?? "Stage failed.");
      else router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function lifecycle(action: "archive" | "fork") {
    setError(null);
    try {
      const res = await fetch(`/api/app/apps/idea-engine/ideas/${idea.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => ({}))) as { idea?: { slug: string }; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Action failed.");
        return;
      }
      if (action === "fork" && body.idea) router.push(`/app/apps/idea-engine/${body.idea.slug}`);
      else router.refresh();
    } catch {
      setError("Network error — try again.");
    }
  }

  function ctaFor(s: StageView): { label: string; disabled?: boolean } {
    if (s.status === "not_started") return { label: s.stage === 1 ? "Done" : "Run this stage" };
    if (s.status === "complete" || s.status === "approved") return { label: "Re-run" };
    if (s.status === "staged") return { label: s.stage === 3 ? "Approve in Mission Control" : "Approve the steps in Mission Control", disabled: true };
    if (s.status === "running") return { label: "Running…", disabled: true };
    if (s.status === "error") return { label: "Try again" };
    return { label: "Run this stage" };
  }

  return (
    <div className="mt-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{idea.title}</h1>
          <p className="text-[12px] text-slate-500 mt-1 font-mono">
            Snapshot: {idea.snapshotPath ?? `brain/ideas/${idea.slug}`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => lifecycle("fork")}
            className="text-[12px] rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-[#22d3ee]/40"
          >
            Fork
          </button>
          {idea.status !== "archived" && (
            <button
              onClick={() => lifecycle("archive")}
              className="text-[12px] rounded-lg border border-slate-700 px-3 py-1.5 text-slate-400 hover:border-rose-500/40 hover:text-rose-300"
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {!hasApiKey && (
        <p className="text-[12px] text-amber-300/80 mt-4">
          Add your Anthropic API key in Settings to run the stages.
        </p>
      )}
      {error && <p className="text-[13px] text-rose-400 mt-4">{error}</p>}

      <div className="mt-6 flex flex-col gap-3">
        {idea.stages.map((s) => {
          const st = STATUS_COPY[s.status] ?? STATUS_COPY.not_started;
          const cta = ctaFor(s);
          const buildNote = s.stage === 4 && !autoBuild ? " (prompt-pack mode)" : "";
          return (
            <div key={s.stage} className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-500">Stage {s.stage}</span>
                    <span className="text-sm font-semibold text-slate-100">{s.name}{buildNote}</span>
                  </div>
                  <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">{s.summary}</p>
                  <p className="text-[11px] text-slate-600 mt-1 font-mono">via {s.backbone}</p>
                  {s.error && <p className="text-[11px] text-rose-400 mt-1">{s.error}</p>}
                </div>
                <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 shrink-0 ${st.cls}`}>
                  {st.label}
                </span>
              </div>
              <div className="mt-3">
                <button
                  onClick={() => runStage(s.stage)}
                  disabled={busy !== null || cta.disabled}
                  className="text-[12px] rounded-lg border border-[#22d3ee]/30 px-3 py-1.5 text-[#22d3ee] hover:bg-[#22d3ee]/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy === s.stage ? "Working…" : cta.label}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
