"use client";

// RoundtableOfferChip — the inline affordance under the assistant's normal answer when PA detects a
// high-confidence decision question (PA-DR §9). Studio+ owners get a "Run Decision Roundtable" button;
// lower tiers get a non-actionable teaser. When the brain already holds a matching verdict, the prior
// decision is surfaced first so yesterday's reasoning is reviewed, not silently re-litigated.

export type RoundtableOffer = {
  question: string;
  eligible: boolean;
  teaser: boolean;
  decisionType: string;
  stakesLevel: string;
  precedent: { path: string; date: string; verdict: string } | null;
};

export default function RoundtableOfferChip({
  offer,
  starting,
  onRun,
  onDismiss,
}: {
  offer: RoundtableOffer;
  starting: boolean;
  onRun: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#34d399]/25 bg-[#34d399]/5 px-4 py-3 mt-2 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <span className="text-[#34d399] text-sm mt-0.5 shrink-0">⚖</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100">This looks like a decision worth a roundtable.</p>
          <p className="text-[13px] text-slate-300 leading-relaxed mt-0.5">
            Three of your agents will argue it out — Steel-man, Devil&apos;s Advocate, Moderator — and bring
            you a verdict you can edit before it saves.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 text-slate-500 hover:text-slate-300 text-xs font-mono"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {offer.precedent && (
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2">
          <p className="text-[12px] text-slate-300">
            <span className="text-[#34d399]/80">PA already has a verdict</span>
            {offer.precedent.date ? ` from ${offer.precedent.date}` : ""} on a question like this.
          </p>
          {offer.precedent.verdict && (
            <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{offer.precedent.verdict}</p>
          )}
        </div>
      )}

      {offer.eligible ? (
        <div className="flex items-center gap-2">
          <button
            onClick={onRun}
            disabled={starting}
            className="rounded-lg bg-[#34d399] px-4 py-2 text-[13px] font-semibold text-[#04231a] hover:bg-[#10b981] disabled:opacity-40 transition-colors"
          >
            {starting ? "Starting…" : offer.precedent ? "Run a fresh roundtable" : "Run Decision Roundtable"}
          </button>
          <button
            onClick={onDismiss}
            className="rounded-lg border border-slate-700 px-3 py-2 text-[13px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            Just answer normally
          </button>
        </div>
      ) : (
        <p className="text-[12px] text-slate-400">
          Decision Roundtable runs the multi-agent debate on Studio+.{" "}
          <a href="/app/settings" className="text-[#34d399]/80 hover:underline">
            See plans →
          </a>
        </p>
      )}
    </div>
  );
}
