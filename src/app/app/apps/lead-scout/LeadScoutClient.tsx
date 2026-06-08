"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LeadScoutSchedule } from "@/lib/leads/types";

export type SourceView = {
  id: string;
  name: string;
  schedule: LeadScoutSchedule;
  projectId: string | null;
  urlCount: number;
  lastRun: { id: string; createdAt: string; leadCount: number; status: string } | null;
};

const SCHEDULE_LABEL: Record<LeadScoutSchedule, string> = {
  on_demand: "On demand",
  daily: "Daily",
  weekly: "Weekly",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// "Coming soon" source kinds — present so the owner sees what's planned, disabled until their phase.
const COMING_KINDS = ["Google Maps (Phase 2)", "Competitor watch (Phase 4)"];

function NewSourceSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [urls, setUrls] = useState("");
  const [pattern, setPattern] = useState("");
  const [schedule, setSchedule] = useState<LeadScoutSchedule>("on_demand");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<{ url: string; reason: string }[]>([]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setRejected([]);
    try {
      const urlList = urls
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter(Boolean);
      const res = await fetch("/api/app/apps/lead-scout/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), extractionPattern: pattern.trim(), urls: urlList, schedule }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        rejected?: { url: string; reason: string }[];
      };
      if (!res.ok) {
        setError(body.error ?? "Couldn't create the source.");
        if (body.rejected) setRejected(body.rejected);
        return;
      }
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = name.trim().length > 0 && pattern.trim().length > 0;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700/60 bg-[#0a0d12] p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-100">New Lead Source</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm">
            Close
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Knoxville roofers — Q3 outreach"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Kind</label>
            <div className="mt-1.5 flex flex-col gap-1.5">
              <span className="inline-flex items-center gap-2 rounded-lg border border-[#22d3ee]/30 bg-[#22d3ee]/5 px-3 py-2 text-sm text-slate-100">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22d3ee]" /> URL list
              </span>
              {COMING_KINDS.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center justify-between rounded-lg border border-slate-800/60 px-3 py-2 text-sm text-slate-600"
                >
                  {k}
                  <span className="text-[10px] font-mono uppercase tracking-wider">Coming soon</span>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              URL list
            </label>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              rows={5}
              placeholder={"One URL per line:\nhttps://example-roofing.com\nhttps://another-contractor.com"}
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 leading-relaxed placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none resize-y font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              What to extract
            </label>
            <textarea
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              rows={3}
              placeholder="Describe what to extract — name, owner, phone, what they do, and whether they look like a fit for roofing supplements."
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 leading-relaxed placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none resize-y"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Schedule
            </label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value as LeadScoutSchedule)}
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 focus:border-[#22d3ee] focus:outline-none"
            >
              <option value="on_demand">On demand — I run it</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {rejected.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-red-400/90">
              {rejected.map((r, i) => (
                <li key={i} className="font-mono truncate">
                  {r.url} — {r.reason}
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={submit}
            disabled={busy || !canSubmit}
            className="min-h-[44px] rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "Creating…" : "Create Lead Source"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceRow({ source, connected }: { source: SourceView; connected: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ranOk, setRanOk] = useState(false);

  async function run() {
    if (running) return;
    setRunning(true);
    setError(null);
    setRanOk(false);
    try {
      const res = await fetch(`/api/app/apps/lead-scout/sources/${source.id}/run`, {
        method: "POST",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(body.message ?? body.error ?? "Run failed.");
        return;
      }
      setRanOk(true);
      router.refresh();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{source.name}</p>
          <p className="text-[12px] text-slate-500 mt-0.5">
            {source.urlCount} {source.urlCount === 1 ? "URL" : "URLs"} · {SCHEDULE_LABEL[source.schedule]}
            {source.lastRun
              ? ` · ${source.lastRun.leadCount} leads, last run ${relativeTime(source.lastRun.createdAt)}`
              : " · never run"}
          </p>
        </div>
        {source.projectId && (
          <Link
            href={`/app/projects/${source.projectId}`}
            className="shrink-0 text-[11px] font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors"
          >
            Open project →
          </Link>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-red-400 font-mono">{error}</p>}
      {ranOk && (
        <p className="mt-3 text-xs text-[#22d3ee]/90">
          Run finished —{" "}
          <Link href="/app/mission-control" className="underline hover:text-[#22d3ee]">
            see the batch in Mission Control →
          </Link>
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={run}
          disabled={running || !connected}
          title={connected ? undefined : "Connect Bright Data in Settings → Connections first."}
          className="min-h-[40px] px-4 rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? "Scouting…" : "Run now"}
        </button>
        {!connected && <span className="text-[11px] text-slate-600">Connect Bright Data to run.</span>}
      </div>
    </div>
  );
}

export default function LeadScoutClient({
  sources,
  connected,
}: {
  sources: SourceView[];
  connected: boolean;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-mono text-slate-400 tracking-[0.14em] uppercase font-semibold">
          Your Lead Sources
        </span>
        <button
          onClick={() => setSheetOpen(true)}
          className="text-xs font-semibold text-[#031820] bg-[#22d3ee] hover:bg-[#06b6d4] rounded-lg px-3 py-2 transition-colors"
        >
          + New Lead Source
        </button>
      </div>

      {sources.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-100">No Lead Sources yet</p>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed max-w-sm mx-auto">
            Make one, paste a list of URLs, and tell PA what to pull out of each page. It visits them,
            extracts a profile, and stages the batch for you.
          </p>
          <button
            onClick={() => setSheetOpen(true)}
            className="mt-4 text-xs font-semibold text-[#031820] bg-[#22d3ee] hover:bg-[#06b6d4] rounded-lg px-3.5 py-2 transition-colors"
          >
            + New Lead Source
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sources.map((s) => (
            <SourceRow key={s.id} source={s} connected={connected} />
          ))}
        </div>
      )}

      {sheetOpen && (
        <NewSourceSheet
          onClose={() => setSheetOpen(false)}
          onCreated={() => {
            setSheetOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
