"use client";

import { useState } from "react";
import Link from "next/link";
import type { LeadClassification } from "@/lib/leads/types";

export type LeadView = {
  id: string;
  name: string;
  domain: string;
  url: string;
  summary: string;
  contact: string;
  classification: LeadClassification;
  status: "extracted" | "failed";
  outreachDrafted: boolean;
};

const CLASS_LABEL: Record<LeadClassification, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  wrong_fit: "Wrong fit",
  needs_research: "Needs research",
};

const CLASS_TONE: Record<LeadClassification, string> = {
  hot: "text-amber-300 border-amber-500/30 bg-amber-500/5",
  warm: "text-[#22d3ee] border-[#22d3ee]/30 bg-[#22d3ee]/5",
  cold: "text-slate-300 border-slate-700/60 bg-slate-800/30",
  wrong_fit: "text-slate-500 border-slate-800/60 bg-transparent",
  needs_research: "text-violet-300/80 border-violet-500/25 bg-violet-500/5",
};

function LeadRow({ lead }: { lead: LeadView }) {
  const [busy, setBusy] = useState(false);
  const [drafted, setDrafted] = useState(lead.outreachDrafted);
  const [err, setErr] = useState<string | null>(null);

  async function draft() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/app/apps/lead-scout/leads/${lead.id}/draft-outreach`, {
        method: "POST",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setErr(body.message ?? body.error ?? `Couldn't draft (${res.status}).`);
        return;
      }
      setDrafted(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-100 truncate">
              {lead.name || lead.domain || lead.url}
            </p>
            <span
              className={`shrink-0 text-[10px] font-mono uppercase tracking-wider rounded border px-1.5 py-0.5 ${CLASS_TONE[lead.classification]}`}
            >
              {CLASS_LABEL[lead.classification]}
            </span>
          </div>
          {lead.summary && (
            <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{lead.summary}</p>
          )}
          {lead.contact && <p className="text-[11px] text-slate-600 mt-0.5 font-mono">{lead.contact}</p>}
        </div>
        {lead.url && (
          <a
            href={lead.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
          >
            visit ↗
          </a>
        )}
      </div>

      {err && <p className="mt-2 text-[11px] text-red-400 font-mono">{err}</p>}

      <div className="mt-3">
        {drafted ? (
          <Link
            href="/app/mission-control"
            className="inline-flex items-center text-[12px] text-amber-300/90 hover:text-amber-200 transition-colors"
          >
            Drafted → review in Mission Control ↗
          </Link>
        ) : (
          <button
            onClick={() => void draft()}
            disabled={busy}
            className="min-h-[36px] px-3.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/70 border border-slate-700/60 text-slate-200 text-[12px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Drafting…" : "Draft outreach for this lead"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RunLeadsClient({
  runId,
  leads,
  warmHotCount,
}: {
  runId: string;
  leads: LeadView[];
  warmHotCount: number;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function draftBatch() {
    if (busy || warmHotCount === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/app/apps/lead-scout/runs/${runId}/draft-outreach`, {
        method: "POST",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as {
        count?: number;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setErr(body.message ?? body.error ?? `Couldn't draft outreach (${res.status}).`);
        return;
      }
      setResult(body.count ?? 0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void draftBatch()}
          disabled={busy || warmHotCount === 0}
          className="min-h-[40px] px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#1a1206] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? "Drafting…" : `Draft outreach for hot + warm${warmHotCount ? ` (${warmHotCount})` : ""}`}
        </button>
        {result !== null && (
          <Link href="/app/mission-control" className="text-[13px] text-amber-300/90 hover:text-amber-200">
            {result} {result === 1 ? "draft" : "drafts"} staged → review in Mission Control ↗
          </Link>
        )}
        {err && <span className="text-[12px] text-red-400 font-mono">{err}</span>}
      </div>

      <div className="flex flex-col gap-2.5">
        {leads.map((lead) => (
          <LeadRow key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}
