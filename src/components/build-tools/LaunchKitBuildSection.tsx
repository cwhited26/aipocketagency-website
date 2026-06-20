// LaunchKitBuildSection — the tier-aware Build Tools block on the Launch Kit (PA-BUILDONBOARD-1).
//
// Pure presentational, no hooks — rendered from the Launch Kit Server Component. Each item is keyed on
// tier (GitHub + Vercel for builders, Supabase for auto-build tiers) and shows its live connected
// state read from the connection rows. These are auto-detected, not manual checkboxes, so a connected
// item shows a "Connected" badge instead of a connect button. Connect links are plain anchors —
// GitHub's button hits an OAuth route handler that redirects.

import type { LaunchKitConnectItem } from "@/lib/build-tools/onboarding";

export function LaunchKitBuildSection({ items }: { items: LaunchKitConnectItem[] }) {
  if (items.length === 0) return null;
  const connectedCount = items.filter((i) => i.connected).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-200">Connect your Build Tools</h2>
        <span className="text-[12px] font-mono text-slate-400">
          {connectedCount} of {items.length}
        </span>
      </div>
      <p className="text-[13px] text-slate-400 leading-relaxed mb-3">
        You signed up to build on the platform. Connect these and what Pocket Agent builds lands on
        your accounts — your repo, your URL, your database. You own all of it.
      </p>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-5 py-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100 leading-snug">{item.title}</p>
                <p className="text-[12px] text-slate-500 leading-relaxed mt-1">{item.blurb}</p>
              </div>
              {item.connected ? (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-[#22d3ee]/30 bg-[#22d3ee]/5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#22d3ee]">
                  <span aria-hidden>✓</span> Connected
                </span>
              ) : null}
            </div>
            {!item.connected ? (
              <a
                href={item.href}
                className="mt-3 inline-flex items-center rounded-lg bg-[#22d3ee] px-3.5 py-2 text-xs font-semibold text-[#06121a] hover:bg-[#22d3ee]/90 transition-colors"
              >
                {item.buttonLabel}
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
