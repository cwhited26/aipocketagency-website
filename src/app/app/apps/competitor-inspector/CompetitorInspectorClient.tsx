"use client";

// CompetitorInspectorClient — the capture form + the run list. A capture holds one long request
// open while the worker runs (the route's maxDuration covers it) and polls the run list so a
// refresh mid-run never loses the state.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExtractionListItem } from "@/lib/url-extraction/db";

type Props = { initialExtractions: ExtractionListItem[] };

const STATUS_LABELS: Record<ExtractionListItem["status"], { label: string; cls: string }> = {
  running: { label: "Reading the site…", cls: "border-[#22d3ee]/40 text-[#22d3ee]" },
  extracted: { label: "Preparing profile", cls: "border-[#22d3ee]/40 text-[#22d3ee]" },
  awaiting_approval: { label: "Waiting on your approval", cls: "border-amber-400/40 text-amber-300" },
  committed: { label: "In your brain", cls: "border-emerald-400/40 text-emerald-300" },
  failed: { label: "Failed", cls: "border-rose-400/40 text-rose-300" },
};

export default function CompetitorInspectorClient({ initialExtractions }: Props) {
  const [extractions, setExtractions] = useState<ExtractionListItem[]>(initialExtractions);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/app/apps/competitor-inspector/extractions", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { extractions: ExtractionListItem[] };
      setExtractions(data.extractions);
    } catch {
      // Poll failures are transient — the next tick retries; the capture request itself reports errors.
    }
  }, []);

  useEffect(() => {
    const hasActive = extractions.some((e) => e.status === "running" || e.status === "extracted");
    if ((running || hasActive) && !pollRef.current) {
      pollRef.current = setInterval(refresh, 5000);
    }
    if (!running && !hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [running, extractions, refresh]);

  const capture = useCallback(
    async (captureUrl: string, captureNote: string) => {
      setRunning(true);
      setMessage(null);
      try {
        const res = await fetch("/api/app/apps/competitor-inspector/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: captureUrl, ...(captureNote ? { note: captureNote } : {}) }),
        });
        const data = (await res.json()) as { error?: string; profilePath?: string };
        if (!res.ok) {
          setMessage({ kind: "error", text: data.error ?? "The capture failed. Try again." });
        } else {
          setMessage({
            kind: "ok",
            text: `Profile ready. The approval card is in Mission Control — approve it and it lands at ${data.profilePath}.`,
          });
          setUrl("");
          setNote("");
        }
      } catch {
        setMessage({
          kind: "error",
          text: "The connection dropped while the capture ran. Check the list below — the run may still have finished.",
        });
      } finally {
        setRunning(false);
        void refresh();
      }
    },
    [refresh],
  );

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!url.trim() || running) return;
          void capture(url.trim(), note.trim());
        }}
        className="rounded-xl border border-slate-800 bg-[#0b1016] px-5 py-5 mb-8"
      >
        <label className="block text-[11px] text-slate-500 font-mono tracking-[0.14em] uppercase mb-1.5">
          Competitor&apos;s web address
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://their-site.com"
          disabled={running}
          className="w-full rounded-lg border border-slate-700 bg-[#06080b] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-[#22d3ee]/60 focus:outline-none disabled:opacity-50"
        />
        <label className="block text-[11px] text-slate-500 font-mono tracking-[0.14em] uppercase mt-4 mb-1.5">
          Note (optional)
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why you're watching them — goes in the profile"
          disabled={running}
          className="w-full rounded-lg border border-slate-700 bg-[#06080b] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-[#22d3ee]/60 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={running || !url.trim()}
          className="mt-4 rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#06080b] hover:bg-[#22d3ee]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? "Reading their site…" : "Capture this competitor"}
        </button>
        {running && (
          <p className="text-[13px] text-slate-500 mt-3">
            PA is walking their page in a real browser — desktop, tablet, and phone widths, plus a
            scroll and hover pass. Leave this open; the approval card shows up in Mission Control
            when it&apos;s done.
          </p>
        )}
        {message && (
          <p className={`text-[13px] mt-3 ${message.kind === "ok" ? "text-emerald-300" : "text-rose-300"}`}>
            {message.text}
          </p>
        )}
      </form>

      <div className="text-[11px] text-slate-500 font-mono tracking-[0.14em] uppercase mb-3">
        Captured profiles
      </div>
      {extractions.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nothing captured yet. Paste a competitor&apos;s address above and PA files the first
          profile.
        </p>
      ) : (
        <ul className="space-y-3">
          {extractions.map((e) => {
            const status = STATUS_LABELS[e.status];
            return (
              <li key={e.id} className="rounded-xl border border-slate-800 bg-[#0b1016] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 truncate">{e.source_url}</p>
                    {e.note && <p className="text-[12px] text-slate-500 truncate mt-0.5">{e.note}</p>}
                    {e.status === "committed" && e.dna_record_path && (
                      <p className="text-[12px] text-slate-500 mt-0.5">
                        <code className="text-[#22d3ee]/70">{e.dna_record_path}</code>
                      </p>
                    )}
                    {e.status === "failed" && e.error && (
                      <p className="text-[12px] text-rose-300/80 mt-0.5">{e.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${status.cls}`}>
                      {status.label}
                    </span>
                    {(e.status === "committed" || e.status === "failed") && (
                      <button
                        type="button"
                        disabled={running}
                        onClick={() => void capture(e.source_url, e.note ?? "")}
                        className="rounded-lg border border-slate-700 px-2.5 py-1 text-[12px] text-slate-300 hover:border-[#22d3ee]/50 hover:text-[#22d3ee] transition-colors disabled:opacity-40"
                      >
                        Re-capture
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
