"use client";

// CapturesClient — the rich Captures feed (PC-CORE-6). Mobile-first (390px), dark to match the app.
// The whole feed arrives as a prop (read server-side from memory/inbox.md), so search, tag filtering,
// and pagination all run in-memory — no per-keystroke server roundtrip. The only server calls are the
// mutations: PATCH tags and DELETE (soft-delete) on /api/app/pocket-capture/captures/[id].

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DashboardCapture, SourceChip } from "@/lib/pocket-capture/dashboard";
import {
  debounce,
  filterCaptures,
  formatRelativeTime,
  hasMore,
  labelForCaptureSource,
  paginate,
  SOURCE_CHIPS,
  topTags,
} from "@/lib/pocket-capture/dashboard";

const PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 200;

// ─── Small building blocks ──────────────────────────────────────────────────────

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const onCopy = useCallback(async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setFailed(true);
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="shrink-0 rounded-lg bg-slate-800/70 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 active:scale-95"
    >
      {failed ? "Copy manually" : copied ? "Copied ✓" : label}
    </button>
  );
}

function TagPill({
  tag,
  active,
  count,
  onClick,
}: {
  tag: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
        active
          ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
          : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
      }`}
    >
      <span className="truncate max-w-[10rem]">#{tag}</span>
      {count !== undefined && <span className="text-[10px] opacity-60">{count}</span>}
    </button>
  );
}

// ─── Edit-tags modal ──────────────────────────────────────────────────────────────

function EditTagsModal({
  capture,
  suggestions,
  onClose,
  onSaved,
}: {
  capture: DashboardCapture;
  suggestions: string[];
  onClose: () => void;
  onSaved: (tags: string[]) => void;
}) {
  const [tags, setTags] = useState<string[]>(capture.tags);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTag = useCallback((value: string) => {
    const t = value.trim().replace(/^#/, "").slice(0, 40);
    if (!t) return;
    setTags((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
    setDraft("");
  }, []);

  const removeTag = useCallback((t: string) => {
    setTags((prev) => prev.filter((x) => x !== t));
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/pocket-capture/captures/${encodeURIComponent(capture.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Couldn't save (${res.status}).`);
        setSaving(false);
        return;
      }
      onSaved(tags);
    } catch {
      setError("Network error saving tags. Try again.");
      setSaving(false);
    }
  }, [capture.id, tags, onSaved]);

  const unusedSuggestions = suggestions
    .filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()))
    .slice(0, 12);

  return (
    <ModalShell title="Edit tags" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-1 text-xs font-medium text-cyan-200"
          >
            #{t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="text-cyan-300/70 hover:text-cyan-100"
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addTag(draft)}
          placeholder={tags.length ? "Add another…" : "Add a tag…"}
          className="min-w-[6rem] flex-1 bg-transparent py-1 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
        />
      </div>

      {unusedSuggestions.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Suggestions</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unusedSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addTag(s)}
                className="rounded-full border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-full border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800/50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="flex-1 rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save tags"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Delete-confirm modal ───────────────────────────────────────────────────────

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
    <ModalShell title="Delete this capture?" onClose={onClose}>
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
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-slate-800 bg-[#0a0e13] p-5 shadow-2xl sm:rounded-2xl safe-pb">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Capture row ────────────────────────────────────────────────────────────────

function CaptureRow({
  capture,
  now,
  expanded,
  onToggle,
  onEditTags,
  onDelete,
}: {
  capture: DashboardCapture;
  now: number;
  expanded: boolean;
  onToggle: () => void;
  onEditTags: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {capture.title && (
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">
                {capture.title}
              </p>
            )}
            <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/70 px-1.5 py-0.5 font-medium text-slate-400">
                <span aria-hidden>{capture.icon}</span>
                {labelForCaptureSource(capture.sourceType)}
              </span>
              <span>{formatRelativeTime(capture.ts, now)}</span>
            </span>
          </div>
          <p className={`text-sm text-slate-400 ${expanded ? "" : "line-clamp-2"}`}>
            {expanded ? capture.content : capture.preview}
          </p>
          {capture.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {capture.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-slate-800/70 px-2 py-0.5 text-[11px] font-medium text-slate-400"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div className="flex gap-2 border-t border-slate-800/70 px-4 py-2.5">
          <button
            type="button"
            onClick={onEditTags}
            className="rounded-lg bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            Edit tags
          </button>
          {capture.source === "url" || /^https?:\/\//.test(capture.content.trim()) ? (
            <a
              href={capture.content.trim().split(/\s+/)[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              Open link ↗
            </a>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-300/80 transition hover:bg-rose-500/10 hover:text-rose-200"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────────

export default function CapturesClient({
  initialCaptures,
  nowMs,
  topSlot,
}: {
  initialCaptures: DashboardCapture[];
  nowMs: number;
  /** Server-rendered content mounted above the feed (the PC-MARK-5 upgrade pitch, self-gated). */
  topSlot?: React.ReactNode;
}) {
  const [captures, setCaptures] = useState<DashboardCapture[]>(initialCaptures);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [source, setSource] = useState<SourceChip>("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<DashboardCapture | null>(null);
  const [deleting, setDeleting] = useState<DashboardCapture | null>(null);
  // First paint uses the server-supplied `now` (no hydration drift); a 60s tick keeps it live.
  const [now, setNow] = useState(nowMs);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Debounce the search box: the in-memory filter only re-applies once typing pauses (200ms).
  const applyQuery = useMemo(() => debounce((v: string) => setQuery(v), SEARCH_DEBOUNCE_MS), []);
  useEffect(() => () => applyQuery.cancel(), [applyQuery]);

  const onSearchChange = (value: string) => {
    setRawQuery(value);
    applyQuery(value);
  };

  // Any filter change resets pagination to the first window.
  useEffect(() => {
    setPage(1);
  }, [query, selectedTags, source]);

  const allTags = useMemo(() => topTags(captures, 10), [captures]);
  const allTagNames = useMemo(() => topTags(captures, 1000).map((t) => t.tag), [captures]);

  // How many live captures fall under each source chip — drives the count shown on each chip.
  const sourceCounts = useMemo(() => {
    const counts = {} as Record<SourceChip, number>;
    for (const chip of SOURCE_CHIPS) {
      counts[chip.key] = filterCaptures(captures, { query: "", tags: [], source: chip.key }).length;
    }
    return counts;
  }, [captures]);

  const filtered = useMemo(
    () => filterCaptures(captures, { query, tags: selectedTags, source }),
    [captures, query, selectedTags, source],
  );
  const visible = useMemo(() => paginate(filtered, page, PER_PAGE), [filtered, page]);
  const more = hasMore(filtered.length, page, PER_PAGE);

  // Infinite scroll: reveal the next window when the sentinel scrolls into view.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !more) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setPage((p) => p + 1);
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [more, visible.length]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.some((t) => t.toLowerCase() === tag.toLowerCase())
        ? prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
        : [...prev, tag],
    );
  };

  const onTagsSaved = (id: string, tags: string[]) => {
    setCaptures((prev) => prev.map((c) => (c.id === id ? { ...c, tags } : c)));
    setEditing(null);
  };

  const onDeleted = (id: string) => {
    setCaptures((prev) => prev.map((c) => (c.id === id ? { ...c, deleted: true } : c)));
    setDeleting(null);
    setExpandedId((cur) => (cur === id ? null : cur));
  };

  const liveCount = useMemo(() => captures.filter((c) => !c.deleted).length, [captures]);

  return (
    <div className="min-h-full bg-[#06080b]">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        {topSlot && <div className="mb-5">{topSlot}</div>}

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">
              Captures Dashboard
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {liveCount} {liveCount === 1 ? "capture" : "captures"} in your brain
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

        {/* Source filter chips — one place for every capture surface */}
        <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
          {SOURCE_CHIPS.map((chip) => {
            const count = sourceCounts[chip.key];
            const active = source === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setSource(chip.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                  active
                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                    : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <span aria-hidden>{chip.icon}</span>
                {chip.label}
                <span className="text-[10px] opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Tag filter pills */}
        {allTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {allTags.map((t) => (
              <TagPill
                key={t.tag}
                tag={t.tag}
                count={t.count}
                active={selectedTags.some((s) => s.toLowerCase() === t.tag.toLowerCase())}
                onClick={() => toggleTag(t.tag)}
              />
            ))}
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-300"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Feed */}
        <div className="mt-5 flex flex-col gap-2.5">
          {visible.length === 0 ? (
            <EmptyFeed hasCaptures={liveCount > 0} hasFilters={Boolean(query) || selectedTags.length > 0} />
          ) : (
            visible.map((c) => (
              <CaptureRow
                key={c.id}
                capture={c}
                now={now}
                expanded={expandedId === c.id}
                onToggle={() => setExpandedId((cur) => (cur === c.id ? null : c.id))}
                onEditTags={() => setEditing(c)}
                onDelete={() => setDeleting(c)}
              />
            ))
          )}
        </div>

        {/* Infinite-scroll sentinel */}
        {more && <div ref={sentinelRef} className="h-10" aria-hidden />}
      </div>

      {editing && (
        <EditTagsModal
          capture={editing}
          suggestions={allTagNames}
          onClose={() => setEditing(null)}
          onSaved={(tags) => onTagsSaved(editing.id, tags)}
        />
      )}
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

function EmptyFeed({ hasCaptures, hasFilters }: { hasCaptures: boolean; hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-6 py-12 text-center">
        <p className="text-sm text-slate-400">No captures match your search.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-6 py-12 text-center">
      <span aria-hidden className="text-3xl">
        📥
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-200">
        {hasCaptures ? "Nothing here yet." : "Your feed is empty."}
      </p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-slate-500">
        Forward an email, text your number, share a link, or speak a note — it lands here the moment it
        arrives.
      </p>
      <Link
        href="/app/captures/settings"
        className="mt-4 inline-flex items-center justify-center rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/50"
      >
        Set up capture →
      </Link>
    </div>
  );
}
