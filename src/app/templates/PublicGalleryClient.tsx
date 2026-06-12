"use client";

// PublicGalleryClient — the public-facing Template Gallery (Template Gallery prominence boost).
// The same browse experience PA owners get at /app/apps/landing-pages/templates — filter pills,
// direction cards with the real captured previews, a detail modal — but with no auth and no build
// flow: every card's CTA is "Sign up to use" pointing at /start. Tier badges stay visible so a
// prospect sees which plan opens which direction before they buy.

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export type PublicDirection = {
  slug: string;
  name: string;
  vibe: string[];
  industries: string[];
  useCases: string[];
  tierLabel: string;
  previewStatic: string | null;
  previewAnimated: string | null;
  palette: string[];
  previewBackground: string;
  previewInk: string;
  previewAccent: string;
  displayFont: string;
  bodyFont: string;
  displayFamily: string | null;
  motifs: string[];
  whenToUse: string[];
  whenNotToUse: string[];
  complexity: "low" | "medium" | "high";
  featured: boolean;
};

const USE_CASE_LABEL: Record<string, string> = {
  hero: "Hero-led",
  "full-landing": "Full landing page",
  about: "About page",
  contact: "Contact page",
};

const COMPLEXITY_LABEL: Record<PublicDirection["complexity"], string> = {
  low: "Quick build",
  medium: "Standard build",
  high: "Big build",
};

function previewFontFamily(d: PublicDirection): string {
  if (d.displayFamily) return `'${d.displayFamily}', ${/serif/i.test(d.displayFont) ? "Georgia, serif" : "sans-serif"}`;
  return /serif/i.test(d.displayFont) && !/sans/i.test(d.displayFont) ? "Georgia, serif" : "inherit";
}

/** A direction's preview: the captured still, the 4s demo clip on hover / in the modal, or the styled placeholder. */
function DirectionPreview({ d, large }: { d: PublicDirection; large?: boolean }) {
  const [hovered, setHovered] = useState(false);
  if (!d.previewStatic) return <PlaceholderPreview d={d} large={large} />;
  const playVideo = d.previewAnimated !== null && (large || hovered);
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: "16 / 9", background: d.previewBackground }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {playVideo && d.previewAnimated ? (
        <video
          src={d.previewAnimated}
          poster={d.previewStatic}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      ) : (
        <Image
          src={d.previewStatic}
          alt={`Preview of the ${d.name} template`}
          fill
          sizes={large ? "672px" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"}
          className="object-cover object-top"
        />
      )}
      {d.previewAnimated && !large && (
        <span className="absolute right-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-white/90">
          Hover to play
        </span>
      )}
    </div>
  );
}

/** The styled stand-in for a direction whose capture is still in the pipeline. */
function PlaceholderPreview({ d, large }: { d: PublicDirection; large?: boolean }) {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: "16 / 9", background: d.previewBackground }}
    >
      <div className="absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{ color: d.previewInk, opacity: 0.55 }}
          >
            {d.vibe[0] ?? "template"}
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider"
            style={{ background: `${d.previewInk}18`, color: d.previewInk, opacity: 0.8 }}
          >
            Real preview coming
          </span>
        </div>
        <div>
          <p
            className={large ? "text-3xl font-bold leading-tight" : "text-xl font-bold leading-tight"}
            style={{ color: d.previewInk, fontFamily: previewFontFamily(d), letterSpacing: "-0.02em" }}
          >
            {d.name.split("—")[0]?.trim() ?? d.name}
          </p>
          <p className="mt-1 text-[11px]" style={{ color: d.previewInk, opacity: 0.65 }}>
            {d.displayFont} · {d.bodyFont}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {d.palette.slice(0, 4).map((c) => (
            <span
              key={c}
              className="h-4 w-4 rounded-full border"
              style={{ background: c, borderColor: `${d.previewInk}33` }}
            />
          ))}
          <span
            className="ml-auto inline-block h-1.5 w-10 rounded-full"
            style={{ background: d.previewAccent }}
          />
        </div>
      </div>
    </div>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
        active
          ? "border-accent/60 bg-accent/15 text-accent"
          : "border-white/15 bg-white/[0.03] text-slate-300 hover:border-white/30"
      }`}
    >
      {label}
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-[#0a0e14] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-slate-300 hover:text-white"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

export default function PublicGalleryClient({ directions }: { directions: PublicDirection[] }) {
  const [vibeFilters, setVibeFilters] = useState<string[]>([]);
  const [industryFilters, setIndustryFilters] = useState<string[]>([]);
  const [useCaseFilter, setUseCaseFilter] = useState<string | null>(null);
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const [detail, setDetail] = useState<PublicDirection | null>(null);

  // Pills come from the catalog itself — the same derivation as the in-app gallery, so the two
  // surfaces always agree: vibes on 2+ directions, industries ranked by how many directions serve them.
  const vibePills = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of directions) for (const v of d.vibe) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([v]) => v).slice(0, 12);
  }, [directions]);

  const industryPills = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of directions) for (const i of d.industries) counts.set(i, (counts.get(i) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([i]) => i);
  }, [directions]);

  const useCasePills = useMemo(() => {
    const set = new Set<string>();
    for (const d of directions) for (const u of d.useCases) set.add(u);
    return [...set];
  }, [directions]);

  const filtered = directions.filter((d) => {
    if (vibeFilters.length > 0 && !vibeFilters.some((v) => d.vibe.includes(v))) return false;
    if (industryFilters.length > 0 && !industryFilters.some((i) => d.industries.includes(i))) return false;
    if (useCaseFilter && !d.useCases.includes(useCaseFilter)) return false;
    return true;
  });

  const activeChips = [
    ...vibeFilters.map((v) => ({ label: v, clear: () => setVibeFilters((f) => f.filter((x) => x !== v)) })),
    ...industryFilters.map((i) => ({ label: i, clear: () => setIndustryFilters((f) => f.filter((x) => x !== i)) })),
    ...(useCaseFilter ? [{ label: USE_CASE_LABEL[useCaseFilter] ?? useCaseFilter, clear: () => setUseCaseFilter(null) }] : []),
  ];

  function toggle(list: string[], setList: (next: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  function browseSimilar(d: PublicDirection) {
    setDetail(null);
    setIndustryFilters([]);
    setUseCaseFilter(null);
    setVibeFilters(d.vibe.filter((v) => vibePills.includes(v)).slice(0, 3));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div>
      {/* Filter pills */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-[11px] font-mono uppercase tracking-wider text-slate-500">Vibe</span>
          {vibePills.map((v) => (
            <Pill key={v} label={v} active={vibeFilters.includes(v)} onClick={() => toggle(vibeFilters, setVibeFilters, v)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-[11px] font-mono uppercase tracking-wider text-slate-500">Industry</span>
          {(showAllIndustries ? industryPills : industryPills.slice(0, 12)).map((i) => (
            <Pill key={i} label={i} active={industryFilters.includes(i)} onClick={() => toggle(industryFilters, setIndustryFilters, i)} />
          ))}
          {industryPills.length > 12 && (
            <button
              type="button"
              onClick={() => setShowAllIndustries((s) => !s)}
              className="text-[12px] text-slate-500 hover:text-slate-300"
            >
              {showAllIndustries ? "Fewer" : `All ${industryPills.length} →`}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-[11px] font-mono uppercase tracking-wider text-slate-500">For</span>
          {useCasePills.map((u) => (
            <Pill
              key={u}
              label={USE_CASE_LABEL[u] ?? u}
              active={useCaseFilter === u}
              onClick={() => setUseCaseFilter(useCaseFilter === u ? null : u)}
            />
          ))}
        </div>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.clear}
              className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[12px] text-accent"
            >
              {chip.label} ×
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setVibeFilters([]);
              setIndustryFilters([]);
              setUseCaseFilter(null);
            }}
            className="text-[12px] text-slate-500 hover:text-slate-300"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
          <p className="text-sm text-slate-300">Nothing matches. Clear a filter or try a different vibe.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((d) => (
            <div
              key={d.slug}
              className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] transition-colors hover:border-white/25"
            >
              <button type="button" onClick={() => setDetail(d)} className="block w-full text-left">
                <DirectionPreview d={d} />
              </button>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug text-slate-100">{d.name}</p>
                  {d.featured && (
                    <span className="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-amber-300">
                      Featured
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.vibe.slice(0, 3).map((v) => (
                    <span key={v} className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-slate-400">
                      {v}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-slate-500">
                  {d.industries.slice(0, 3).join(" · ")}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    href="/start"
                    className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-foreground hover:opacity-90"
                  >
                    Sign up to use
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDetail(d)}
                    className="text-[12px] text-slate-500 hover:text-slate-300"
                  >
                    Details
                  </button>
                  <span className="ml-auto shrink-0 text-[10px] font-mono uppercase tracking-wider text-slate-600">
                    {d.tierLabel}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <Modal onClose={() => setDetail(null)}>
          <DirectionPreview d={detail} large />
          <div className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-100">{detail.name}</h2>
                <p className="mt-0.5 text-[13px] text-slate-400">{detail.vibe.join(" · ")}</p>
              </div>
              <span className="shrink-0 rounded border border-white/15 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                {COMPLEXITY_LABEL[detail.complexity]}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                {detail.palette.map((c) => (
                  <span key={c} className="h-6 w-6 rounded-full border border-white/15" style={{ background: c }} />
                ))}
              </div>
              <p className="text-[13px] text-slate-300" style={{ fontFamily: previewFontFamily(detail) }}>
                Aa — {detail.displayFont}
                <span className="text-slate-500"> with {detail.bodyFont}</span>
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-emerald-300">
                  What it&apos;s good for
                </p>
                <ul className="space-y-1.5">
                  {detail.whenToUse.slice(0, 6).map((w) => (
                    <li key={w} className="text-[13px] leading-snug text-slate-300">
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-amber-300">
                  What it&apos;s not good for
                </p>
                <ul className="space-y-1.5">
                  {detail.whenNotToUse.slice(0, 6).map((w) => (
                    <li key={w} className="text-[13px] leading-snug text-slate-400">
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-slate-300">
                Signature moves
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detail.motifs.slice(0, 8).map((m) => (
                  <span key={m} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-slate-400">
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/start"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                Sign up to use this template
              </Link>
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-600">
                Opens at {detail.tierLabel}
              </span>
              <button
                type="button"
                onClick={() => browseSimilar(detail)}
                className="text-[13px] text-slate-400 hover:text-slate-200"
              >
                Browse similar →
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
