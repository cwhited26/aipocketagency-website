"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type PackView = {
  name: string;
  verticalSlug: string;
  icon: string;
  tagline: string;
  description: string;
  category: string;
  radiusMiles: number;
  minReviews: number | null;
  recommendedTier: "Studio" | "Studio+";
};

type SubscribeResponse = {
  projectId?: string | null;
  runStatus?: "ran" | "needs_setup" | "run_failed";
  run?: { lead_count: number };
  message?: string;
  error?: string;
};

function PackCard({ pack, canSubscribe }: { pack: PackView; canSubscribe: boolean }) {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // The first-sweep preview line — what this pack pulls before the owner has typed a place.
  const sweepPreview =
    `Sweeps ${pack.category} within ${pack.radiusMiles} miles` +
    (pack.minReviews != null ? `, ${pack.minReviews}+ reviews` : "") +
    `, no website.`;

  async function subscribe() {
    if (busy) return;
    if (location.trim().length < 2) {
      setError("Add a city or area first — like \"Knoxville, TN\".");
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(
        `/api/app/apps/lead-scout/packs/${pack.verticalSlug}/subscribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location: location.trim() }),
          cache: "no-store",
        },
      );
      const body = (await res.json().catch(() => ({}))) as SubscribeResponse;
      if (!res.ok) {
        setError(body.message ?? body.error ?? "Couldn't subscribe to this pack.");
        return;
      }
      // Land the owner in the source's Project Workspace; fall back to the Lead Scout list.
      if (body.projectId) {
        router.push(`/app/projects/${body.projectId}`);
      } else {
        router.push("/app/apps/lead-scout");
      }
      router.refresh();
      if (body.runStatus !== "ran") {
        setNote(body.message ?? "Source created — connect Bright Data, then run it.");
      }
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

      <div className="mt-3 rounded-lg border border-slate-800/70 bg-slate-950/50 px-3 py-2">
        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">First sweep</p>
        <p className="text-[12px] text-slate-300 mt-0.5">{sweepPreview}</p>
      </div>

      {canSubscribe ? (
        <div className="mt-4 flex flex-col gap-2">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Where to look — Knoxville, TN"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") subscribe();
            }}
          />
          <button
            onClick={subscribe}
            disabled={busy}
            className="min-h-[44px] rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "Subscribing…" : "Subscribe + run first sweep"}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
          {note && <p className="text-xs text-amber-300/90">{note}</p>}
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

export default function PacksClient({
  packs,
  canSubscribe,
}: {
  packs: PackView[];
  canSubscribe: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {packs.map((pack) => (
        <PackCard key={pack.verticalSlug} pack={pack} canSubscribe={canSubscribe} />
      ))}
    </div>
  );
}
