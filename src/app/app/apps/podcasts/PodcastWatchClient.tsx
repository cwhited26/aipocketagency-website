"use client";

// PodcastWatchClient — the show-watch surface (Phase 2). Lists the shows PA is following, lets the
// owner add one from any Apple Podcasts or RSS link, change cadence, flip an individual show to
// notes-only (cost-light), pause/resume/stop, and one-tap-add suggested shows derived from their brain
// (creators + rivals) and ingest history. A count chip surfaces ingests from the last 24h. With zero
// watches it leads with a "stop being the last to hear it" intro + three examples.

import { useState, useEffect, useCallback } from "react";

type Cadence = "realtime" | "daily" | "weekly";

type Watch = {
  id: string;
  showId: string;
  podcastUrl: string;
  podcastTitle: string;
  artworkUrl: string;
  cadence: Cadence;
  notesOnlyMode: boolean;
  paused: boolean;
  errorCount: number;
};

type Suggestion = {
  showId: string;
  title: string;
  host: string;
  feedUrl: string;
  artworkUrl: string;
  appleUrl: string;
  reason: string;
  cadence: Cadence;
};

type WatchData = { watches: Watch[]; suggestions: Suggestion[]; recentCount: number };

const CADENCE_LABEL: Record<Cadence, string> = {
  realtime: "Realtime",
  daily: "Daily",
  weekly: "Weekly",
};
const CADENCE_CYCLE: Cadence[] = ["realtime", "daily", "weekly"];
const ERROR_AUTOPAUSE = 5;

function CadencePill({ cadence, onCycle }: { cadence: Cadence; onCycle: () => void }) {
  return (
    <button
      onClick={onCycle}
      className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#22d3ee]/25 text-[#22d3ee]/80 hover:border-[#22d3ee]/50 transition-colors"
      title="Tap to change how often PA checks for new episodes"
    >
      {CADENCE_LABEL[cadence]}
    </button>
  );
}

export default function PodcastWatchClient() {
  const [data, setData] = useState<WatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [addRef, setAddRef] = useState("");
  const [addCadence, setAddCadence] = useState<Cadence>("weekly");
  const [addNotesOnly, setAddNotesOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    fetch("/api/app/podcasts/watch", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<WatchData>) : Promise.reject()))
      .then(setData)
      .catch(() => setData({ watches: [], suggestions: [], recentCount: 0 }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addByRef(ref: string, cadence: Cadence, notesOnly: boolean) {
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/app/podcasts/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref, cadence, notesOnly, addedFrom: "manual" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setAddError(body.error ?? "Couldn't add that show.");
        return;
      }
      setAddRef("");
      load();
    } catch {
      setAddError("Couldn't reach the server. Try again.");
    } finally {
      setAdding(false);
    }
  }

  async function addSuggestion(s: Suggestion) {
    setAdding(true);
    try {
      await fetch("/api/app/podcasts/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          show: {
            showId: s.showId,
            feedUrl: s.feedUrl,
            podcastUrl: s.appleUrl || s.feedUrl,
            title: s.title,
            artworkUrl: s.artworkUrl,
          },
          cadence: s.cadence,
          addedFrom: "suggestion",
        }),
      });
      load();
    } finally {
      setAdding(false);
    }
  }

  async function patchWatch(id: string, patch: { paused?: boolean; cadence?: Cadence; notesOnly?: boolean }) {
    await fetch(`/api/app/podcasts/watch/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function stopWatch(id: string) {
    await fetch(`/api/app/podcasts/watch/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) {
    return <p className="text-[12px] font-mono text-slate-500">Loading the shows you&apos;re following…</p>;
  }

  const watches = data?.watches ?? [];
  const suggestions = (data?.suggestions ?? []).filter((s) => !dismissed.has(s.showId));
  const recentCount = data?.recentCount ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header + 24h ingest badge */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-100">Shows you&apos;re watching</h2>
        {recentCount > 0 && (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-[#22d3ee]/30 bg-[#22d3ee]/10 text-[#22d3ee]">
            {recentCount} new in 24h
          </span>
        )}
      </div>

      {/* Add a show */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={addRef}
            onChange={(e) => setAddRef(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && addRef.trim() && !adding) void addByRef(addRef.trim(), addCadence, addNotesOnly);
            }}
            placeholder="Paste an Apple Podcasts page or an RSS feed URL…"
            className="flex-1 bg-[#0b1016] border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#22d3ee]/50"
          />
          <select
            value={addCadence}
            onChange={(e) => setAddCadence(e.target.value as Cadence)}
            className="bg-[#0b1016] border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
          >
            {CADENCE_CYCLE.map((c) => (
              <option key={c} value={c}>
                {CADENCE_LABEL[c]}
              </option>
            ))}
          </select>
          <button
            onClick={() => addRef.trim() && void addByRef(addRef.trim(), addCadence, addNotesOnly)}
            disabled={adding || !addRef.trim()}
            className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors disabled:opacity-50"
          >
            {adding ? "Adding…" : "Watch"}
          </button>
        </div>
        <label className="mt-2.5 flex items-center gap-2 text-[12px] text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={addNotesOnly}
            onChange={(e) => setAddNotesOnly(e.target.checked)}
            className="accent-[#22d3ee]"
          />
          Notes-only — read the show notes, skip the transcription (a fraction of the cost).
        </label>
        {addError && <p className="mt-2 text-[12px] text-amber-300/90">{addError}</p>}
      </div>

      {/* Zero-state intro */}
      {watches.length === 0 ? (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-5 py-5">
          <h3 className="text-sm font-semibold text-slate-100">Stop being the last to hear it.</h3>
          <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
            Follow a show and PA catches every new episode the moment it drops — listens to it, files
            what matters in your brain, and surfaces it. A few ways owners use it:
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-[13px] text-slate-400">
            <li className="flex gap-2">
              <span className="text-[#22d3ee]/60 shrink-0">◆</span>
              Follow the show a competitor guests on — PA logs what they claimed the morning it posts.
            </li>
            <li className="flex gap-2">
              <span className="text-[#22d3ee]/60 shrink-0">◆</span>
              Follow Hormozi, Brunson, whoever you learn from — PA pulls the tactics into your voice influences automatically.
            </li>
            <li className="flex gap-2">
              <span className="text-[#22d3ee]/60 shrink-0">◆</span>
              Follow an industry show on notes-only — PA tells you what each episode was about for a fraction of a cent.
            </li>
          </ul>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {watches.map((w) => {
            const autopaused = w.paused && w.errorCount >= ERROR_AUTOPAUSE;
            return (
              <li key={w.id} className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 flex items-center gap-3">
                {w.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote show artwork; next/image isn't configured for it.
                  <img src={w.artworkUrl} alt={w.podcastTitle} className="w-9 h-9 rounded-lg border border-slate-700/60 shrink-0 object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-lg border border-slate-700/60 bg-[#0b1016] shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200 truncate">{w.podcastTitle}</p>
                  <p className="text-[11px] font-mono text-slate-500 truncate">
                    {w.notesOnlyMode ? "Notes-only" : "Full transcript"}
                    {w.paused && " · paused"}
                  </p>
                  {autopaused && (
                    <p className="text-[11px] text-amber-300/80 mt-0.5">
                      Paused after repeated errors — this show&apos;s feed may be gone.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => void patchWatch(w.id, { notesOnly: !w.notesOnlyMode })}
                  className="text-[10px] font-mono px-2 py-0.5 rounded border border-slate-600/50 text-slate-400 hover:border-slate-400 transition-colors"
                  title="Toggle notes-only (read the show notes, skip transcription)"
                >
                  {w.notesOnlyMode ? "Notes" : "Full"}
                </button>
                <CadencePill
                  cadence={w.cadence}
                  onCycle={() => {
                    const next = CADENCE_CYCLE[(CADENCE_CYCLE.indexOf(w.cadence) + 1) % CADENCE_CYCLE.length];
                    void patchWatch(w.id, { cadence: next });
                  }}
                />
                {!w.paused ? (
                  <button
                    onClick={() => void patchWatch(w.id, { paused: true })}
                    className="text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={() => void patchWatch(w.id, { paused: false })}
                    className="text-[11px] font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors"
                  >
                    Resume
                  </button>
                )}
                <button
                  onClick={() => void stopWatch(w.id)}
                  className="text-[11px] font-mono text-slate-500 hover:text-amber-300 transition-colors"
                >
                  Stop
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Suggested shows */}
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
            Suggested from your brain
          </span>
          <ul className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <li key={s.showId} className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 flex items-center gap-3">
                {s.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote show artwork; next/image isn't configured for it.
                  <img src={s.artworkUrl} alt={s.title} className="w-9 h-9 rounded-lg border border-slate-700/60 shrink-0 object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-lg border border-slate-700/60 bg-[#0b1016] shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200 truncate">{s.title}</p>
                  <p className="text-[12px] text-slate-500 leading-relaxed">
                    {s.reason} · suggested {CADENCE_LABEL[s.cadence]}
                  </p>
                </div>
                <button
                  onClick={() => void addSuggestion(s)}
                  disabled={adding}
                  className="text-[11px] font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors disabled:opacity-50"
                >
                  + Watch this show
                </button>
                <button
                  onClick={() => setDismissed((prev) => new Set(prev).add(s.showId))}
                  className="text-[11px] font-mono text-slate-600 hover:text-slate-400 transition-colors"
                  aria-label="Dismiss suggestion"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
