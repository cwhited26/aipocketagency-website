"use client";

import { useState } from "react";
import Link from "next/link";

export type PackShowView = { title: string; host: string };

export type PackView = {
  name: string;
  verticalSlug: string;
  icon: string;
  tagline: string;
  description: string;
  defaultCadence: "realtime" | "daily" | "weekly";
  shows: PackShowView[];
  recommendedTier: "Studio" | "Studio+";
};

const CADENCE_LABEL: Record<PackView["defaultCadence"], string> = {
  realtime: "Realtime",
  daily: "Daily",
  weekly: "Weekly",
};

type SubscribeResponse = { subscribed?: number; total?: number; error?: string; message?: string };

function PackCard({ pack, canSubscribe }: { pack: PackView; canSubscribe: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function subscribeAll() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/app/apps/podcasts/packs/${pack.verticalSlug}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as SubscribeResponse;
      if (!res.ok) {
        setError(body.message ?? body.error ?? "Couldn't subscribe to this pack.");
        return;
      }
      setDone(`Now following ${body.subscribed ?? pack.shows.length} shows — new episodes land in your brain.`);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl leading-none" aria-hidden>
            {pack.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate">{pack.name}</p>
            <p className="text-[12px] text-slate-400 mt-0.5">{pack.tagline}</p>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-[#22d3ee]/70 border border-[#22d3ee]/20 rounded px-1.5 py-0.5">
          {pack.recommendedTier}
        </span>
      </div>

      <p className="text-[13px] text-slate-400 mt-3 leading-relaxed">{pack.description}</p>

      <div className="mt-3 rounded-lg border border-slate-800/70 bg-slate-950/50 px-3 py-2.5">
        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
          {pack.shows.length} shows · followed {CADENCE_LABEL[pack.defaultCadence]}
        </p>
        <ul className="mt-1.5 flex flex-col gap-1">
          {pack.shows.map((s) => (
            <li key={s.title} className="text-[12px] text-slate-300 truncate">
              <span className="text-slate-200">{s.title}</span>
              {s.host && <span className="text-slate-500"> — {s.host}</span>}
            </li>
          ))}
        </ul>
      </div>

      {canSubscribe ? (
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={subscribeAll}
            disabled={busy || done !== null}
            className="min-h-[44px] rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "Subscribing…" : done ? "Following ✓" : `Follow all ${pack.shows.length} shows`}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
          {done && <p className="text-xs text-[#22d3ee]/90">{done}</p>}
        </div>
      ) : (
        <Link
          href="/pricing"
          className="mt-4 min-h-[44px] flex items-center justify-center rounded-xl border border-[#22d3ee]/30 text-[#22d3ee] text-sm font-semibold hover:bg-[#22d3ee]/5 transition-colors"
        >
          Upgrade to Studio+ to subscribe
        </Link>
      )}
    </div>
  );
}

export default function PacksClient({ packs, canSubscribe }: { packs: PackView[]; canSubscribe: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {packs.map((pack) => (
        <PackCard key={pack.verticalSlug} pack={pack} canSubscribe={canSubscribe} />
      ))}
    </div>
  );
}
