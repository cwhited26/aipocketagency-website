"use client";

// TemplateGalleryClient — the Template Gallery surface (PA-TG-1..2, SPEC Phase 1). Grid of direction
// cards with filter pills (industry / vibe / use case), a detail modal per direction, and the
// "Use this template" flow: three questions → confirm → the existing Landing Page Builder pipeline
// (create the page row, fire the build, approvals land in Mission Control). The three original
// starter templates ride at the bottom as the quick-start fallback.

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { LandingPageView } from "@/lib/landing-pages/types";

export type GalleryDirection = {
  slug: string;
  name: string;
  vibe: string[];
  industries: string[];
  useCases: string[];
  locked: boolean;
  tierLabel: string;
  /** Captured still under /templates/ (PA-TG-3); null falls back to the styled placeholder. */
  previewStatic: string | null;
  /** 4s muted demo clip — non-null only when the owner's tier unlocks animated previews. */
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
  isNew: boolean;
};

export type QuickStartTemplate = {
  id: string;
  label: string;
  description: string;
  bestFor: string;
};

type Props = {
  directions: GalleryDirection[];
  quickStart: QuickStartTemplate[];
  canBuild: boolean;
  hasApiKey: boolean;
  brainConnected: boolean;
};

const USE_CASE_LABEL: Record<string, string> = {
  hero: "Hero-led",
  "full-landing": "Full landing page",
  about: "About page",
  contact: "Contact page",
};

const COMPLEXITY_LABEL: Record<GalleryDirection["complexity"], string> = {
  low: "Quick build",
  medium: "Standard build",
  high: "Big build",
};

const VISITOR_ACTIONS = ["Book a call", "Buy", "Call us", "Sign up", "Browse", "Something else"] as const;

function previewFontFamily(d: GalleryDirection): string {
  if (d.displayFamily) return `'${d.displayFamily}', ${/serif/i.test(d.displayFont) ? "Georgia, serif" : "sans-serif"}`;
  return /serif/i.test(d.displayFont) && !/sans/i.test(d.displayFont) ? "Georgia, serif" : "inherit";
}

/**
 * A direction's visual preview (PA-TG-3). With a captured still it renders the real screenshot;
 * with an animated clip it plays it in the detail modal and on card hover (Studio+ only — the
 * server nulls previewAnimated below that tier). Without a capture it falls back to the styled
 * placeholder so the other directions keep their "Real preview coming" chip.
 */
function DirectionPreview({ d, large }: { d: GalleryDirection; large?: boolean }) {
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

/** The styled stand-in for a direction that doesn't have a captured preview yet. */
function PlaceholderPreview({ d, large }: { d: GalleryDirection; large?: boolean }) {
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

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
        active
          ? "border-[#22d3ee]/60 bg-[#22d3ee]/15 text-[#22d3ee]"
          : "border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500"
      }`}
    >
      {label}
    </button>
  );
}

export default function TemplateGalleryClient({
  directions,
  quickStart,
  canBuild,
  hasApiKey,
  brainConnected,
}: Props) {
  const [vibeFilters, setVibeFilters] = useState<string[]>([]);
  const [industryFilters, setIndustryFilters] = useState<string[]>([]);
  const [useCaseFilter, setUseCaseFilter] = useState<string | null>(null);
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const [detail, setDetail] = useState<GalleryDirection | null>(null);
  const [useTarget, setUseTarget] = useState<{ kind: "direction"; d: GalleryDirection } | { kind: "quick"; t: QuickStartTemplate } | null>(null);

  // Pills come from the catalog itself: vibes that appear on 2+ directions, industries ranked by
  // how many directions serve them (top 12, expandable) — every pill returns at least one card.
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

  function browseSimilar(d: GalleryDirection) {
    setDetail(null);
    setIndustryFilters([]);
    setUseCaseFilter(null);
    setVibeFilters(d.vibe.filter((v) => vibePills.includes(v)).slice(0, 3));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div>
      {!canBuild && (
        <div className="mb-6 rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/5 px-5 py-4">
          <p className="text-sm font-semibold text-slate-100">Building a page is a Studio feature</p>
          <p className="text-sm text-slate-300 mt-1 leading-relaxed">
            Browse every template here. To build one on your own GitHub and Vercel, move up to Studio.{" "}
            <a href="/app/settings/tier" className="text-[#22d3ee] hover:underline">
              See plans →
            </a>
          </p>
        </div>
      )}
      {!hasApiKey && canBuild && (
        <div className="mb-6 rounded-xl border border-slate-700/60 bg-slate-900/60 px-5 py-4">
          <p className="text-sm font-semibold text-slate-100">Add your Anthropic API key</p>
          <p className="text-sm text-slate-300 mt-1 leading-relaxed">
            PA writes the page with your key.{" "}
            <a href="/app/settings" className="text-[#22d3ee] hover:underline">
              Go to Settings →
            </a>
          </p>
        </div>
      )}

      {/* Filter pills */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 w-16 shrink-0">Vibe</span>
          {vibePills.map((v) => (
            <Pill key={v} label={v} active={vibeFilters.includes(v)} onClick={() => toggle(vibeFilters, setVibeFilters, v)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 w-16 shrink-0">Industry</span>
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
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 w-16 shrink-0">For</span>
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
              className="rounded-full border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-3 py-1 text-[12px] text-[#22d3ee]"
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
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-6 py-12 text-center">
          <p className="text-sm text-slate-300">Nothing matches. Clear a filter or try a different vibe.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((d) => (
            <div
              key={d.slug}
              className="group overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950/50 transition-colors hover:border-slate-600"
            >
              <button type="button" onClick={() => setDetail(d)} className="block w-full text-left">
                <DirectionPreview d={d} />
              </button>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-100 leading-snug">{d.name}</p>
                  {d.locked && (
                    <a
                      href="/pricing"
                      className="shrink-0 rounded border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[#22d3ee] hover:bg-[#22d3ee]/20"
                    >
                      {d.tierLabel} unlock
                    </a>
                  )}
                  {d.featured && !d.locked && (
                    <span className="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-amber-300">
                      Featured
                    </span>
                  )}
                  {d.isNew && !d.featured && !d.locked && (
                    <span className="shrink-0 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-emerald-300">
                      New
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.vibe.slice(0, 3).map((v) => (
                    <span key={v} className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
                      {v}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                  {d.industries.slice(0, 3).join(" · ")}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {d.locked ? (
                    <>
                      <button
                        type="button"
                        disabled
                        title={`Unlocks at ${d.tierLabel}`}
                        className="cursor-not-allowed rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-slate-600"
                      >
                        Use this template
                      </button>
                      <a
                        href="/pricing"
                        className="rounded-full border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-2.5 py-1 text-[11px] text-[#22d3ee] hover:bg-[#22d3ee]/20"
                      >
                        Unlocks at {d.tierLabel} →
                      </a>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setUseTarget({ kind: "direction", d })}
                      className="rounded-lg bg-[#22d3ee] px-3 py-1.5 text-[12px] font-semibold text-[#06121a] hover:bg-[#22d3ee]/90"
                    >
                      Use this template
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetail(d)}
                    className="text-[12px] text-slate-500 hover:text-slate-300"
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick start — the three originals */}
      <div className="mt-12">
        <p className="text-sm font-semibold text-slate-100">Quick start</p>
        <p className="text-[13px] text-slate-400 mt-1 mb-4">
          The three simple layouts the Builder started with. No design direction, just a clean page —
          still the fastest path when you need something up today.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickStart.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-4">
              <p className="text-[13px] font-semibold text-slate-100">{t.label}</p>
              <p className="text-[12px] text-slate-400 mt-1 leading-snug">{t.bestFor}</p>
              <button
                type="button"
                onClick={() => setUseTarget({ kind: "quick", t })}
                className="mt-3 rounded-lg border border-slate-700 px-3 py-1.5 text-[12px] text-slate-200 hover:border-slate-500"
              >
                Use this layout
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Detail modal */}
      {detail && (
        <Modal onClose={() => setDetail(null)}>
          <DirectionPreview d={detail} large />
          <div className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-100">{detail.name}</h2>
                <p className="text-[13px] text-slate-400 mt-0.5">{detail.vibe.join(" · ")}</p>
              </div>
              <span className="shrink-0 rounded border border-slate-700 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                {COMPLEXITY_LABEL[detail.complexity]}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                {detail.palette.map((c) => (
                  <span key={c} className="h-6 w-6 rounded-full border border-slate-700" style={{ background: c }} />
                ))}
              </div>
              <p className="text-[13px] text-slate-300" style={{ fontFamily: previewFontFamily(detail) }}>
                Aa — {detail.displayFont}
                <span className="text-slate-500"> with {detail.bodyFont}</span>
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className="text-[12px] font-semibold text-emerald-300 uppercase tracking-wider mb-2">
                  What it&apos;s good for
                </p>
                <ul className="space-y-1.5">
                  {detail.whenToUse.slice(0, 6).map((w) => (
                    <li key={w} className="text-[13px] text-slate-300 leading-snug">
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-amber-300 uppercase tracking-wider mb-2">
                  What it&apos;s not good for
                </p>
                <ul className="space-y-1.5">
                  {detail.whenNotToUse.slice(0, 6).map((w) => (
                    <li key={w} className="text-[13px] text-slate-400 leading-snug">
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[12px] font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Signature moves
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detail.motifs.slice(0, 8).map((m) => (
                  <span key={m} className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400">
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {detail.locked ? (
                <>
                  <button
                    type="button"
                    disabled
                    title={`Unlocks at ${detail.tierLabel}`}
                    className="cursor-not-allowed rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-600"
                  >
                    Use this template
                  </button>
                  <a
                    href="/pricing"
                    className="rounded-lg border border-[#22d3ee]/50 bg-[#22d3ee]/10 px-4 py-2 text-sm font-semibold text-[#22d3ee]"
                  >
                    Unlocks at {detail.tierLabel} — see plans →
                  </a>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setUseTarget({ kind: "direction", d: detail });
                    setDetail(null);
                  }}
                  className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#06121a] hover:bg-[#22d3ee]/90"
                >
                  Use this template
                </button>
              )}
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

      {/* Use-this-template flow */}
      {useTarget && (
        <UseTemplateModal
          target={useTarget}
          canBuild={canBuild}
          hasApiKey={hasApiKey}
          brainConnected={brainConnected}
          onClose={() => setUseTarget(null)}
        />
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-[#0a0e14] shadow-2xl"
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

type UseTarget = { kind: "direction"; d: GalleryDirection } | { kind: "quick"; t: QuickStartTemplate };

function UseTemplateModal({
  target,
  canBuild,
  hasApiKey,
  brainConnected,
  onClose,
}: {
  target: UseTarget;
  canBuild: boolean;
  hasApiKey: boolean;
  brainConnected: boolean;
  onClose: () => void;
}) {
  const templateName = target.kind === "direction" ? target.d.name : target.t.label;
  const templateRef = target.kind === "direction" ? `direction:${target.d.slug}` : target.t.id;

  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [title, setTitle] = useState(templateName.split("—")[0]?.trim() ?? templateName);
  const [headline, setHeadline] = useState("");
  const [paPicksColor, setPaPicksColor] = useState(true);
  const [brandColor, setBrandColor] = useState("#1a1a1a");
  const [action, setAction] = useState<string>(VISITOR_ACTIONS[0]);
  const [otherAction, setOtherAction] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState("");

  const visitorAction = action === "Something else" ? otherAction.trim() : action;

  function composedDescription(): string {
    const parts = [
      target.kind === "direction"
        ? `Build a landing page with the "${target.d.name}" template from the gallery.`
        : `Build a landing page with the "${target.t.label}" layout.`,
      visitorAction ? `The one thing a visitor should do on this page: ${visitorAction}.` : "",
      headline.trim() ? `The headline should say: "${headline.trim()}"` : "Write the headline from what the brain knows about the business.",
      paPicksColor
        ? "Use the brand color from the brain if there is one."
        : `Use ${brandColor} as the primary brand color.`,
    ];
    return parts.filter(Boolean).join(" ");
  }

  async function fireBuild() {
    setSubmitting(true);
    setError(null);
    try {
      const createRes = await fetch("/api/app/apps/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: composedDescription(),
          template: templateRef,
        }),
      });
      const created = (await createRes.json()) as { page?: LandingPageView; message?: string; error?: string };
      if (!createRes.ok || !created.page) {
        setError(created.message ?? created.error ?? "Couldn't create the page.");
        return;
      }
      const buildRes = await fetch(`/api/app/apps/landing-pages/${created.page.id}/build`, { method: "POST" });
      const built = (await buildRes.json()) as { message?: string; error?: string };
      if (!buildRes.ok && buildRes.status !== 409) {
        setError(built.message ?? built.error ?? "The page is saved, but the build didn't start. Retry it from your pages list.");
        return;
      }
      setDoneMessage(
        built.message ?? "Build started — the first step is waiting for your approval in Mission Control.",
      );
      setStep("done");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <p className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-1">
          Use this template
        </p>
        <h2 className="text-lg font-bold text-slate-100">{templateName}</h2>

        {!canBuild ? (
          <div className="mt-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              Building a page on your own GitHub and Vercel is a Studio feature. Move up and PA builds
              this one for you, step by approved step.
            </p>
            <a
              href="/app/settings/tier"
              className="mt-4 inline-block rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#06121a]"
            >
              See plans →
            </a>
          </div>
        ) : step === "form" ? (
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label className="text-[12px] text-slate-400 block mb-1">What&apos;s the page called?</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 focus:border-[#22d3ee]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[12px] text-slate-400 block mb-1">
                What should the headline say?{" "}
                <span className="text-slate-600">
                  {brainConnected ? "Leave it blank and PA writes it from your brain." : "Leave it blank and PA writes one from your description."}
                </span>
              </label>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-[#22d3ee]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[12px] text-slate-400 block mb-1">Primary brand color?</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPaPicksColor(true)}
                  className={`rounded-lg border px-3 py-1.5 text-[12px] ${paPicksColor ? "border-[#22d3ee]/60 bg-[#22d3ee]/10 text-[#22d3ee]" : "border-slate-700 text-slate-300"}`}
                >
                  {brainConnected ? "PA picks from my brain" : "PA picks one that fits"}
                </button>
                <button
                  type="button"
                  onClick={() => setPaPicksColor(false)}
                  className={`rounded-lg border px-3 py-1.5 text-[12px] ${!paPicksColor ? "border-[#22d3ee]/60 bg-[#22d3ee]/10 text-[#22d3ee]" : "border-slate-700 text-slate-300"}`}
                >
                  I&apos;ll set it
                </button>
                {!paPicksColor && (
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    aria-label="Brand color"
                    className="h-8 w-12 cursor-pointer rounded border border-slate-700 bg-transparent"
                  />
                )}
              </div>
            </div>
            <div>
              <label className="text-[12px] text-slate-400 block mb-1">What should a visitor do?</label>
              <div className="flex flex-wrap gap-2">
                {VISITOR_ACTIONS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAction(a)}
                    className={`rounded-full border px-3 py-1 text-[12px] ${action === a ? "border-[#22d3ee]/60 bg-[#22d3ee]/15 text-[#22d3ee]" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              {action === "Something else" && (
                <input
                  value={otherAction}
                  onChange={(e) => setOtherAction(e.target.value)}
                  placeholder="Tell PA what the visitor should do"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-[#22d3ee]/50 focus:outline-none"
                />
              )}
            </div>
            {error && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-200">
                {error}
              </p>
            )}
            <div>
              <button
                type="button"
                onClick={() => {
                  if (!title.trim()) {
                    setError("Give the page a name first.");
                    return;
                  }
                  if (action === "Something else" && !otherAction.trim()) {
                    setError("Tell PA what the visitor should do.");
                    return;
                  }
                  setError(null);
                  setStep("confirm");
                }}
                className="rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#06121a] hover:bg-[#22d3ee]/90"
              >
                Next →
              </button>
            </div>
          </div>
        ) : step === "confirm" ? (
          <div className="mt-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-[13px] leading-relaxed text-slate-300">
              <p>
                <span className="text-slate-500">Template:</span> {templateName}
              </p>
              <p className="mt-1">
                <span className="text-slate-500">Page:</span> {title.trim()}
              </p>
              <p className="mt-1">
                <span className="text-slate-500">Headline:</span>{" "}
                {headline.trim() ? `"${headline.trim()}"` : "PA writes it"}
              </p>
              <p className="mt-1">
                <span className="text-slate-500">Brand color:</span>{" "}
                {paPicksColor ? "PA picks it" : brandColor}
              </p>
              <p className="mt-1">
                <span className="text-slate-500">Visitor&apos;s one action:</span> {visitorAction}
              </p>
            </div>
            {!hasApiKey && (
              <p className="mt-3 text-[13px] text-amber-200">
                Add your Anthropic API key in Settings first — PA writes the page with your key.
              </p>
            )}
            {error && (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-200">
                {error}
              </p>
            )}
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={fireBuild}
                disabled={submitting || !hasApiKey}
                className="rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#06121a] hover:bg-[#22d3ee]/90 disabled:opacity-50"
              >
                {submitting ? "Starting…" : "Build this page"}
              </button>
              <button
                type="button"
                onClick={() => setStep("form")}
                disabled={submitting}
                className="text-[13px] text-slate-400 hover:text-slate-200 disabled:opacity-50"
              >
                ← Back
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-slate-200 leading-relaxed">{doneMessage}</p>
            <div className="mt-4 flex items-center gap-3">
              <Link
                href="/app/apps/landing-pages"
                className="rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#06121a] hover:bg-[#22d3ee]/90"
              >
                See your pages →
              </Link>
              <button type="button" onClick={onClose} className="text-[13px] text-slate-400 hover:text-slate-200">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
