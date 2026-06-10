"use client";

// YouTubeWatchClient — the channel-watch surface (v1.1). Lists the channels PA is watching, lets the
// owner add one from any link/handle, change cadence, pause/resume/stop, and one-tap-add suggested
// channels derived from their ingest history. A count chip surfaces ingests from the last 24h. When
// there are zero watches, it leads with a "stop being the last to know" intro + three examples.

import { useState, useEffect, useCallback } from "react";
import { YOUTUBE } from "@/lib/copy/in-app";

type Cadence = "realtime" | "daily" | "weekly";
type Status = "active" | "paused" | "stopped";

type Watch = {
  id: string;
  channelId: string;
  channelHandle: string;
  displayName: string;
  avatarUrl: string;
  cadence: Cadence;
  status: Status;
  errorCount: number;
  lastVideoId: string | null;
};

type Suggestion = {
  channelId: string;
  displayName: string;
  reason: string;
  cadence: Cadence;
  videoCount: number;
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
      title="Tap to change how often PA checks"
    >
      {CADENCE_LABEL[cadence]}
    </button>
  );
}

export default function YouTubeWatchClient() {
  const [data, setData] = useState<WatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [addRef, setAddRef] = useState("");
  const [addCadence, setAddCadence] = useState<Cadence>("daily");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    fetch("/api/app/youtube/watch", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<WatchData>) : Promise.reject()))
      .then(setData)
      .catch(() => setData({ watches: [], suggestions: [], recentCount: 0 }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addWatch(ref: string, cadence: Cadence, addedFrom: "manual" | "suggestion") {
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/app/youtube/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref, cadence, addedFrom }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setAddError(body.error ?? "Couldn't add that channel.");
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

  async function patchWatch(id: string, patch: { status?: Status; cadence?: Cadence }) {
    await fetch(`/api/app/youtube/watch/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  if (loading) {
    return <p className="text-[12px] font-mono text-slate-500">Loading your watched channels…</p>;
  }

  const watches = data?.watches ?? [];
  const suggestions = (data?.suggestions ?? []).filter((s) => !dismissed.has(s.channelId));
  const recentCount = data?.recentCount ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header + 24h ingest badge */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-100">Channels you&apos;re watching</h2>
        {recentCount > 0 && (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-[#22d3ee]/30 bg-[#22d3ee]/10 text-[#22d3ee]">
            {recentCount} new in 24h
          </span>
        )}
      </div>

      {/* Add a channel */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={addRef}
            onChange={(e) => setAddRef(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && addRef.trim() && !adding) void addWatch(addRef.trim(), addCadence, "manual");
            }}
            placeholder="Paste a channel link, @handle, or any video URL…"
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
            onClick={() => addRef.trim() && void addWatch(addRef.trim(), addCadence, "manual")}
            disabled={adding || !addRef.trim()}
            className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors disabled:opacity-50"
          >
            {adding ? "Adding…" : "Watch"}
          </button>
        </div>
        {addError && <p className="mt-2 text-[12px] text-amber-300/90">{addError}</p>}
      </div>

      {/* Zero-state intro */}
      {watches.length === 0 ? (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-5 py-5">
          <h3 className="text-sm font-semibold text-slate-100">{YOUTUBE.empty.headline}</h3>
          <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
            {YOUTUBE.empty.subheadline}
          </p>
          <p className="mt-2 text-[13px] text-slate-400 leading-relaxed">
            {YOUTUBE.empty.body}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {watches.map((w) => {
            const autopaused = w.status === "paused" && w.errorCount >= ERROR_AUTOPAUSE;
            return (
              <li key={w.id} className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 flex items-center gap-3">
                {w.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote channel avatar; next/image isn't configured for it.
                  <img src={w.avatarUrl} alt={w.displayName} className="w-9 h-9 rounded-full border border-slate-700/60 shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full border border-slate-700/60 bg-[#0b1016] shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200 truncate">{w.displayName}</p>
                  <p className="text-[11px] font-mono text-slate-500 truncate">
                    {w.channelHandle}
                    {w.status === "paused" && " · paused"}
                  </p>
                  {autopaused && (
                    <p className="text-[11px] text-amber-300/80 mt-0.5">
                      Paused after repeated errors — this channel may have been deleted.
                    </p>
                  )}
                </div>
                <CadencePill
                  cadence={w.cadence}
                  onCycle={() => {
                    const next = CADENCE_CYCLE[(CADENCE_CYCLE.indexOf(w.cadence) + 1) % CADENCE_CYCLE.length];
                    void patchWatch(w.id, { cadence: next });
                  }}
                />
                {w.status === "active" ? (
                  <button
                    onClick={() => void patchWatch(w.id, { status: "paused" })}
                    className="text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={() => void patchWatch(w.id, { status: "active" })}
                    className="text-[11px] font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors"
                  >
                    Resume
                  </button>
                )}
                <button
                  onClick={() => void patchWatch(w.id, { status: "stopped" })}
                  className="text-[11px] font-mono text-slate-500 hover:text-amber-300 transition-colors"
                >
                  Stop
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Suggested channels */}
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
            Suggested from what you&apos;ve shared
          </span>
          <ul className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <li key={s.channelId} className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200 truncate">{s.displayName}</p>
                  <p className="text-[12px] text-slate-500 leading-relaxed">
                    {s.reason} · suggested {CADENCE_LABEL[s.cadence]}
                  </p>
                </div>
                <button
                  onClick={() => void addWatch(s.channelId, s.cadence, "suggestion")}
                  disabled={adding}
                  className="text-[11px] font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors disabled:opacity-50"
                >
                  + Watch
                </button>
                <button
                  onClick={() => setDismissed((prev) => new Set(prev).add(s.channelId))}
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
