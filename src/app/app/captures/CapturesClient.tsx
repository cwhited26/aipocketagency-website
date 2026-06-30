"use client";

// CapturesClient — the Captures Dashboard, redesigned with a MindChuk-style colored tab strip and
// color-coded cards (PC-CORE-6 + the tag-tabs redesign). Mobile-first (390px), dark to match the app.
// The whole feed arrives as a prop (read server-side from the brain), so tab filtering, search, and
// pagination run in-memory — no per-keystroke roundtrip. Server calls are only the mutations:
//   • PATCH /api/app/pocket-capture/captures/[id]  { tags } — assign a tab / edit tags
//   • DELETE same route                                     — soft-delete
// Tab definitions are owned by Settings → Capture Tags; here they only colour + filter the feed.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DashboardCapture } from "@/lib/pocket-capture/dashboard";
import { debounce, formatRelativeTime, labelForCaptureSource } from "@/lib/pocket-capture/dashboard";
import {
  ALL_TAB_ID,
  ALL_TAB_NAME,
  assignedTab,
  autoClassifyTab,
  captureMatchesTab,
  moveToTab,
  type CaptureTag,
} from "@/lib/pocket-capture/tags";

const PER_PAGE = 30;
const SEARCH_DEBOUNCE_MS = 200;
const NEUTRAL_HEX = "#64748b"; // slate-500 — the "All"/untagged accent
const TITLE_MAX = 60;

// ─── Pure view helpers ────────────────────────────────────────────────────────────

/** The card's display title: an explicit title, else the first non-empty line of the body, ≤60 chars. */
function deriveTitle(capture: DashboardCapture): string {
  const base =
    capture.title?.trim() ||
    capture.content
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ||
    "(empty capture)";
  return base.length > TITLE_MAX ? `${base.slice(0, TITLE_MAX - 1).trimEnd()}…` : base;
}

/** A tinted rgba from a #rrggbb hex at the given alpha (for chip/border fills). */
function tint(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(100,116,139,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

type Tab = { id: string; name: string; colorHex: string };

// ─── Move-to-tag dropdown ──────────────────────────────────────────────────────────

function MoveToTagMenu({
  tabs,
  current,
  onPick,
}: {
  tabs: Tab[];
  current: string | null;
  onPick: (tabName: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg bg-slate-800/70 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
      >
        Move to ▾
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-1.5 w-44 overflow-hidden rounded-xl border border-slate-700 bg-[#0a0e13] shadow-xl">
          {tabs.map((t) => {
            const isAll = t.id === ALL_TAB_ID;
            const active = isAll ? current === null : current === t.name;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onPick(isAll ? null : t.name);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-slate-800/70 ${
                  active ? "text-slate-100" : "text-slate-300"
                }`}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: isAll ? NEUTRAL_HEX : t.colorHex }}
                />
                <span className="truncate">{isAll ? "Untagged" : t.name}</span>
                {active && <span className="ml-auto text-cyan-300">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Capture card ──────────────────────────────────────────────────────────────────

function CaptureCard({
  capture,
  tabs,
  colorOf,
  now,
  expanded,
  suggestion,
  onToggle,
  onMove,
  onApproveSuggestion,
  onRejectSuggestion,
  onReclassify,
  onDelete,
}: {
  capture: DashboardCapture;
  tabs: Tab[];
  colorOf: (tabName: string | null) => string;
  now: number;
  expanded: boolean;
  /** A suggested tab (untagged capture, auto-classifier had an opinion, not yet approved/rejected). */
  suggestion: string | null;
  onToggle: () => void;
  onMove: (tabName: string | null) => void;
  onApproveSuggestion: (tabName: string) => void;
  onRejectSuggestion: () => void;
  onReclassify: () => void;
  onDelete: () => void;
}) {
  const current = assignedTab(capture.tags, tabs.filter((t) => t.id !== ALL_TAB_ID));
  const accent = colorOf(current);
  const title = deriveTitle(capture);
  const isVoice = capture.sourceType === "voice-memo";
  const isUrl = capture.source === "url" || /^https?:\/\//.test(capture.content.trim());
  const link = isUrl ? capture.content.trim().split(/\s+/)[0] : null;

  return (
    <article
      className="capture-card mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <button type="button" onClick={onToggle} className="block w-full px-4 py-3 text-left">
        {/* Header: timestamp · tag chip · source icon */}
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>{formatRelativeTime(capture.ts, now)}</span>
          {current && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
              style={{ backgroundColor: tint(accent, 0.16), color: accent }}
            >
              {current}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-800/70 px-1.5 py-0.5 font-medium text-slate-400">
            <span aria-hidden>{capture.icon}</span>
            {labelForCaptureSource(capture.sourceType)}
          </span>
        </div>

        {/* Title */}
        <h3 className="mt-1.5 text-sm font-semibold leading-snug text-slate-100">{title}</h3>

        {/* Body — voice memos lead with a 🎙️ transcript treatment; the model is transcript-only today,
            so we render an <audio> element only if a future surface attaches a playable url. */}
        {isVoice ? (
          <div className="mt-1.5">
            {capture.audioUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio controls preload="none" src={capture.audioUrl} className="mb-2 w-full" />
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                🎙️ Transcript
              </span>
            )}
            <p className={`mt-1 whitespace-pre-wrap text-sm text-slate-400 ${expanded ? "" : "line-clamp-3"}`}>
              {expanded ? capture.content : capture.preview}
            </p>
          </div>
        ) : (
          <p className={`mt-1.5 whitespace-pre-wrap text-sm text-slate-400 ${expanded ? "" : "line-clamp-3"}`}>
            {expanded ? capture.content : capture.preview}
          </p>
        )}

        {/* Free-form (non-tab) tags */}
        {capture.tags.filter((t) => t.toLowerCase() !== (current ?? "").toLowerCase()).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {capture.tags
              .filter((t) => t.toLowerCase() !== (current ?? "").toLowerCase())
              .map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                >
                  #{t}
                </span>
              ))}
          </div>
        )}
      </button>

      {/* Suggested-tab banner (the auto-classifier "staged" a tab for an untagged capture) */}
      {!current && suggestion && (
        <div
          className="mx-4 mb-3 flex items-center gap-2 rounded-xl border px-3 py-2"
          style={{ borderColor: tint(colorOf(suggestion), 0.4), backgroundColor: tint(colorOf(suggestion), 0.08) }}
        >
          <span className="text-xs text-slate-300">
            Looks like <span style={{ color: colorOf(suggestion) }} className="font-semibold">{suggestion}</span>
          </span>
          <button
            type="button"
            onClick={() => onApproveSuggestion(suggestion)}
            className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-slate-950"
            style={{ backgroundColor: colorOf(suggestion) }}
          >
            Approve
          </button>
          <button
            type="button"
            onClick={onRejectSuggestion}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Reject
          </button>
        </div>
      )}

      {/* Footer actions */}
      {expanded && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/70 px-4 py-2.5">
          <MoveToTagMenu tabs={tabs} current={current} onPick={onMove} />
          <button
            type="button"
            onClick={onReclassify}
            className="rounded-lg bg-slate-800/70 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            Re-classify
          </button>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-slate-800/70 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              Open ↗
            </a>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-300/80 transition hover:bg-rose-500/10 hover:text-rose-200"
          >
            Delete
          </button>
        </div>
      )}
    </article>
  );
}

// ─── Delete-confirm modal ────────────────────────────────────────────────────────────

function DeleteModal({
  capture,
  onClose,
  onDeleted,
}: {
  capture: DashboardCapture;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = useCallback(async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/pocket-capture/captures/${encodeURIComponent(capture.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Couldn't delete (${res.status}).`);
        setDeleting(false);
        return;
      }
      onDeleted();
    } catch {
      setError("Network error deleting. Try again.");
      setDeleting(false);
    }
  }, [capture.id, onDeleted]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-slate-800 bg-[#0a0e13] p-5 shadow-2xl safe-pb sm:rounded-2xl">
        <h2 className="mb-3 text-base font-bold text-slate-100">Delete this capture?</h2>
        <p className="text-sm leading-relaxed text-slate-400">
          It&apos;ll be hidden from your feed. The original stays in your brain history — nothing is
          permanently erased.
        </p>
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <p className="line-clamp-3 text-sm text-slate-300">{capture.preview}</p>
        </div>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800/50"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={deleting}
            className="flex-1 rounded-full bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Per-tab empty state ─────────────────────────────────────────────────────────────

const TAB_TIPS: Record<string, string> = {
  Wins: "Text or forward your wins — a closed deal, a glowing review — and tag them here.",
  Ideas: "Speak a “Hey Siri” note or share a link the moment an idea strikes; tag it here.",
  Tasks: "Forward a to-do by email or text — it lands here ready to action.",
  Reference: "Share an article or doc from any app; it files itself here for later.",
};

function EmptyTab({ tabName, hasAnyCaptures }: { tabName: string; hasAnyCaptures: boolean }) {
  const tip =
    tabName === ALL_TAB_NAME
      ? "Forward an email, text your number, share a link, or speak a note — it lands here the moment it arrives."
      : TAB_TIPS[tabName] ?? `Move a capture into ${tabName}, or capture something and tag it ${tabName}.`;
  return (
    <div className="col-span-full rounded-2xl border border-slate-800 bg-slate-900/40 px-6 py-12 text-center">
      <span aria-hidden className="text-3xl">
        {tabName === ALL_TAB_NAME ? "📥" : "🏷️"}
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-200">
        {tabName === ALL_TAB_NAME
          ? hasAnyCaptures
            ? "Nothing matches."
            : "Your feed is empty."
          : `No ${tabName} captures yet.`}
      </p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-slate-500">{tip}</p>
      <Link
        href="/app/captures/settings"
        className="mt-4 inline-flex items-center justify-center rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/50"
      >
        Set up capture →
      </Link>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────────────

export default function CapturesClient({
  initialCaptures,
  tags,
  nowMs,
  topSlot,
}: {
  initialCaptures: DashboardCapture[];
  tags: CaptureTag[];
  nowMs: number;
  topSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const [captures, setCaptures] = useState<DashboardCapture[]>(initialCaptures);
  // Re-sync if the server refreshes (pull-to-refresh / navigation) with a new feed.
  useEffect(() => setCaptures(initialCaptures), [initialCaptures]);

  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB_NAME);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DashboardCapture | null>(null);
  const [now, setNow] = useState(nowMs);
  // Auto-suggestions the owner rejected this session (so they don't re-appear until Re-classify).
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<string>>(() => new Set());
  const [moveError, setMoveError] = useState<string | null>(null);

  // The tab strip: virtual "All" first, then the owner's tags in order.
  const tabs = useMemo<Tab[]>(
    () => [
      { id: ALL_TAB_ID, name: ALL_TAB_NAME, colorHex: NEUTRAL_HEX },
      ...tags.map((t) => ({ id: t.id, name: t.name, colorHex: t.colorHex })),
    ],
    [tags],
  );
  const realTabs = useMemo(() => tabs.filter((t) => t.id !== ALL_TAB_ID), [tabs]);
  const colorOf = useCallback(
    (tabName: string | null) => realTabs.find((t) => t.name === tabName)?.colorHex ?? NEUTRAL_HEX,
    [realTabs],
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const applyQuery = useMemo(() => debounce((v: string) => setQuery(v), SEARCH_DEBOUNCE_MS), []);
  useEffect(() => () => applyQuery.cancel(), [applyQuery]);
  const onSearchChange = (value: string) => {
    setRawQuery(value);
    applyQuery(value);
  };

  useEffect(() => setPage(1), [query, activeTab]);

  const live = useMemo(() => captures.filter((c) => !c.deleted), [captures]);

  // Search + tab filter (AND), in-memory. Tab membership uses the owner's defined tabs.
  const matchesSearch = useCallback(
    (c: DashboardCapture) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [c.title ?? "", c.content, c.tags.join(" ")].join(" ").toLowerCase().includes(q);
    },
    [query],
  );
  const filtered = useMemo(
    () => live.filter((c) => captureMatchesTab(c.tags, activeTab, realTabs) && matchesSearch(c)),
    [live, activeTab, realTabs, matchesSearch],
  );
  const visible = useMemo(() => filtered.slice(0, page * PER_PAGE), [filtered, page]);
  const more = filtered.length > page * PER_PAGE;

  // Per-tab counts for the strip (respect the active search so counts match what a tab would show).
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tabs) {
      counts[t.name] = live.filter((c) => captureMatchesTab(c.tags, t.name, realTabs) && matchesSearch(c)).length;
    }
    return counts;
  }, [tabs, live, realTabs, matchesSearch]);

  // Suggested tab per visible capture (untagged + classifier opinion + not rejected this session).
  const suggestionFor = useCallback(
    (c: DashboardCapture): string | null => {
      if (assignedTab(c.tags, realTabs)) return null;
      if (rejectedSuggestions.has(c.id)) return null;
      const guess = autoClassifyTab(`${c.title ?? ""} ${c.content}`);
      // Only suggest a tab the owner actually has.
      return guess && realTabs.some((t) => t.name === guess) ? guess : null;
    },
    [realTabs, rejectedSuggestions],
  );

  // Infinite scroll sentinel.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !more) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setPage((p) => p + 1);
      },
      { rootMargin: "500px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [more, visible.length]);

  // ── Mutations ───────────────────────────────────────────────────────────────────────
  // Keep a ref to the latest captures so an optimistic rollback restores the right snapshot.
  const capturesRef = useRef(captures);
  useEffect(() => {
    capturesRef.current = captures;
  }, [captures]);

  const commitTags = useCallback(async (id: string, nextTags: string[]) => {
    setMoveError(null);
    const prevState = capturesRef.current;
    setCaptures((prev) => prev.map((c) => (c.id === id ? { ...c, tags: nextTags } : c)));
    try {
      const res = await fetch(`/api/app/pocket-capture/captures/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextTags }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setMoveError(body.error ?? "Couldn't update that capture.");
        setCaptures(prevState); // roll back the optimistic move
      }
    } catch {
      setMoveError("Network error — that change didn't save.");
      setCaptures(prevState);
    }
  }, []);

  const onMove = useCallback(
    (capture: DashboardCapture, tabName: string | null) => {
      void commitTags(capture.id, moveToTab(capture.tags, tabName, realTabs));
    },
    [commitTags, realTabs],
  );

  const onApproveSuggestion = useCallback(
    (capture: DashboardCapture, tabName: string) => {
      void commitTags(capture.id, moveToTab(capture.tags, tabName, realTabs));
    },
    [commitTags, realTabs],
  );

  const onReclassify = useCallback((id: string) => {
    // Clear any prior rejection so the (possibly new) suggestion surfaces again.
    setRejectedSuggestions((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const onReject = useCallback((id: string) => {
    setRejectedSuggestions((prev) => new Set(prev).add(id));
  }, []);

  const onDeleted = useCallback((id: string) => {
    setCaptures((prev) => prev.map((c) => (c.id === id ? { ...c, deleted: true } : c)));
    setDeleting(null);
    setExpandedId((cur) => (cur === id ? null : cur));
  }, []);

  // ── Mobile gestures: swipe between tabs + pull to refresh ─────────────────────────────
  const touch = useRef<{ x: number; y: number; atTop: boolean } | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, atTop: window.scrollY <= 2 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dy = e.touches[0].clientY - touch.current.y;
    if (touch.current.atTop && dy > 0 && Math.abs(e.touches[0].clientX - touch.current.x) < 40) {
      setPull(Math.min(90, dy * 0.5)); // rubber-band the pull indicator
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;

    if (pull > 60) {
      setRefreshing(true);
      router.refresh();
      window.setTimeout(() => setRefreshing(false), 1200);
    }
    setPull(0);

    // Horizontal swipe → previous / next tab.
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40) {
      const idx = tabs.findIndex((t) => t.name === activeTab);
      const nextIdx = dx < 0 ? Math.min(tabs.length - 1, idx + 1) : Math.max(0, idx - 1);
      if (nextIdx !== idx) setActiveTab(tabs[nextIdx].name);
    }
  };

  return (
    <div
      className="min-h-full bg-[#06080b] [scroll-behavior:smooth]"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Card filter animation (CSS-only) + masonry tuning */}
      <style>{`
        @keyframes captureIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .capture-card { animation: captureIn 0.22s ease both; }
        @media (prefers-reduced-motion: reduce) { .capture-card { animation: none; } }
      `}</style>

      {/* Pull-to-refresh indicator */}
      {(pull > 0 || refreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden text-xs text-slate-400 transition-[height]"
          style={{ height: refreshing ? 36 : pull }}
        >
          {refreshing ? "Refreshing…" : pull > 60 ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {topSlot && <div className="mb-5">{topSlot}</div>}

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Captures</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {live.length} {live.length === 1 ? "capture" : "captures"} in your brain
            </p>
          </div>
          <Link
            href="/app/captures/settings"
            className="shrink-0 rounded-full border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-700 hover:text-slate-100"
          >
            Settings
          </Link>
        </div>

        {/* Search */}
        <div className="mt-5">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-2.5">
            <span aria-hidden className="text-slate-500">
              🔍
            </span>
            <input
              value={rawQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search your captures…"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
              type="search"
            />
            {rawQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="text-slate-500 hover:text-slate-300"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Tag tabs */}
        <div
          role="tablist"
          aria-label="Capture tags"
          className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((t) => {
            const active = activeTab === t.name;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setActiveTab(t.name)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                  active ? "text-slate-50" : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200"
                }`}
                style={
                  active
                    ? { backgroundColor: tint(t.colorHex, 0.16), borderColor: tint(t.colorHex, 0.5) }
                    : undefined
                }
              >
                {t.id !== ALL_TAB_ID && (
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: t.colorHex }} />
                )}
                <span>{t.name}</span>
                <span className="text-[10px] opacity-60">{tabCounts[t.name] ?? 0}</span>
              </button>
            );
          })}
          <Link
            href="/app/captures/settings#capture-tags"
            className="inline-flex shrink-0 items-center rounded-full border border-dashed border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-300"
          >
            + Edit tags
          </Link>
        </div>

        {moveError && <p className="mt-3 text-sm text-rose-300">{moveError}</p>}

        {/* Masonry feed: 1 / 2 / 3 columns. Keyed by tab+query so cards re-animate on filter change. */}
        <div key={`${activeTab}:${query}`} className="mt-5 gap-3 sm:columns-2 lg:columns-3">
          {visible.length === 0 ? (
            <EmptyTab tabName={activeTab} hasAnyCaptures={live.length > 0} />
          ) : (
            visible.map((c) => (
              <CaptureCard
                key={c.id}
                capture={c}
                tabs={tabs}
                colorOf={colorOf}
                now={now}
                expanded={expandedId === c.id}
                suggestion={suggestionFor(c)}
                onToggle={() => setExpandedId((cur) => (cur === c.id ? null : c.id))}
                onMove={(tabName) => onMove(c, tabName)}
                onApproveSuggestion={(tabName) => onApproveSuggestion(c, tabName)}
                onRejectSuggestion={() => onReject(c.id)}
                onReclassify={() => onReclassify(c.id)}
                onDelete={() => setDeleting(c)}
              />
            ))
          )}
        </div>

        {more && <div ref={sentinelRef} className="h-10" aria-hidden />}
      </div>

      {deleting && (
        <DeleteModal
          capture={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => onDeleted(deleting.id)}
        />
      )}
    </div>
  );
}
