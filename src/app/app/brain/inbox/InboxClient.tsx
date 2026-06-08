"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { InboxEntry, InboxKind } from "@/lib/pa-inbox";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Items captured without a real date fall back to the Unix epoch (new Date(0)).
// Treat anything before this as "no capture date" so we render no timestamp pill
// instead of a confusing "Dec 31, 1969".
const MIN_VALID_TS = Date.UTC(2000, 0, 1);

function formatTs(iso: string): string | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t) || t < MIN_VALID_TS) return null;
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function kindLabel(kind: InboxKind): string {
  switch (kind) {
    case "url":
      return "link";
    case "note":
      return "note";
    case "text":
      return "text";
    case "voice":
      return "voice";
  }
}

function kindColor(kind: InboxKind): string {
  switch (kind) {
    case "url":
      return "text-[#22d3ee]/80 bg-[#22d3ee]/8 border-[#22d3ee]/20";
    case "note":
      return "text-violet-400/80 bg-violet-400/8 border-violet-400/20";
    case "text":
      return "text-slate-400 bg-slate-800/60 border-slate-700/40";
    case "voice":
      return "text-amber-400/80 bg-amber-400/8 border-amber-400/20";
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

// ─── Per-row component ────────────────────────────────────────────────────────

function InboxRow({
  entry,
  onRemove,
}: {
  entry: InboxEntry;
  onRemove: (id: string) => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  const [removeErr, setRemoveErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function handleRemove() {
    if (removing) return;
    setRemoving(true);
    setRemoveErr(null);
    try {
      await onRemove(entry.id);
    } catch (e) {
      setRemoveErr(e instanceof Error ? e.message : "Remove failed");
      setRemoving(false);
    }
  }

  const displayTitle = entry.title ?? truncate(entry.content, 90);
  // Body text distinct from the title — only when the entry carries a title.
  const bodyPreview = entry.title ? truncate(entry.content, 280) : null;
  // Link cards open the URL on tap; note/text/voice cards expand inline to show
  // the full body — but only when there's hidden content worth a tap.
  const isUrl = entry.kind === "url";
  const canExpand =
    !isUrl && entry.content.length > (entry.title ? 280 : 90);

  const ts = formatTs(entry.ts);

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-4 flex flex-col gap-2.5">
      {/* Top row: kind badge + timestamp + remove */}
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${kindColor(entry.kind)}`}
        >
          {kindLabel(entry.kind)}
        </span>
        <span className="text-[10px] font-mono text-slate-600 flex-1 min-w-0 truncate">
          {ts ?? ""}
        </span>
        <button
          onClick={() => void handleRemove()}
          disabled={removing}
          aria-label="Remove this item"
          className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-700 hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {removing ? (
            <span className="text-[10px] font-mono animate-pulse">…</span>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Title / content — tappable to expand on note/text/voice cards */}
      {canExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="group text-left w-full flex flex-col gap-2"
        >
          <p className="text-sm text-slate-200 leading-snug font-medium break-words">
            {displayTitle}
          </p>
          {expanded ? (
            <div className="prose-brain text-xs leading-relaxed break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {entry.content}
              </ReactMarkdown>
            </div>
          ) : (
            bodyPreview && (
              <p className="text-xs text-slate-500 leading-relaxed break-words">
                {bodyPreview}
              </p>
            )
          )}
          <span className="text-[10px] font-mono text-slate-600 group-hover:text-[#22d3ee] transition-colors">
            {expanded ? "▲ collapse" : "▼ tap to read full note"}
          </span>
        </button>
      ) : (
        <>
          <p className="text-sm text-slate-200 leading-snug font-medium break-words">
            {displayTitle}
          </p>
          {bodyPreview && (
            <p className="text-xs text-slate-500 leading-relaxed break-words">
              {bodyPreview}
            </p>
          )}
        </>
      )}

      {/* Source URL — break-all so long receipt/query URLs wrap instead of
          bleeding off the right edge of the card on mobile. */}
      {entry.sourceUrl && (
        <a
          href={entry.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-[11px] font-mono text-[#22d3ee]/60 hover:text-[#22d3ee] transition-colors break-all leading-tight py-1"
        >
          {entry.sourceUrl.replace(/^https?:\/\//, "")}
        </a>
      )}

      {/* Documents link — appears once the share file has been promoted into assets/.
          Triaging (the × above) deletes the sessions/inbox artifact but leaves the asset. */}
      {entry.assetPath && (
        <a
          href="/app/documents"
          className="block text-[11px] font-mono text-[#38bdf8]/70 hover:text-[#38bdf8] transition-colors py-1"
        >
          View in Documents →
        </a>
      )}

      {/* Remove error */}
      {removeErr && (
        <p className="text-[10px] font-mono text-red-400">{removeErr}</p>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function InboxClient({
  initialEntries,
  hasBrain,
}: {
  initialEntries: InboxEntry[];
  hasBrain: boolean;
}) {
  const [entries, setEntries] = useState<InboxEntry[]>(initialEntries);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // Tracks share files we've already kicked off a promote for, so the effect doesn't
  // re-fire when setEntries re-runs it (the server promote is idempotent regardless).
  const promotingRef = useRef<Set<string>>(new Set());

  // Auto-promote share-extension files (sessions/inbox/*) into assets/ + memory the moment
  // the owner opens the inbox, so every captured file reaches Documents without a manual step.
  useEffect(() => {
    const pending = entries.filter(
      (e): e is InboxEntry & { path: string } =>
        typeof e.path === "string" &&
        e.path.startsWith("sessions/inbox/") &&
        !e.assetPath &&
        !promotingRef.current.has(e.path),
    );
    if (pending.length === 0) return;
    for (const e of pending) promotingRef.current.add(e.path);

    void Promise.all(
      pending.map(async (e) => {
        try {
          const res = await fetch("/api/app/brain/inbox", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promote: e.path }),
          });
          if (!res.ok) {
            promotingRef.current.delete(e.path); // let a later visit retry
            return;
          }
          const body = (await res.json()) as { assetPath?: string };
          if (body.assetPath) {
            const asset = body.assetPath;
            setEntries((prev) =>
              prev.map((x) => (x.id === e.id ? { ...x, assetPath: asset } : x)),
            );
          }
        } catch {
          // Background promotion is best-effort; on a network failure clear the marker so
          // the next inbox visit retries. The asset/absorb commit is idempotent server-side.
          promotingRef.current.delete(e.path);
        }
      }),
    );
  }, [entries]);

  async function handleRemove(id: string) {
    setRemovingId(id);
    const target = entries.find((e) => e.id === id);
    // File-backed entries (iOS share) are removed by path; block entries by id.
    const payload = target?.path ? { path: target.path } : { id };
    const res = await fetch("/api/app/brain/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setRemovingId(null);
      throw new Error(body.error ?? `Remove failed (${res.status})`);
    }
    // Optimistic: remove from local state
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setRemovingId(null);
  }

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-xl mx-auto px-5 py-8 flex flex-col gap-5">

        {/* Header */}
        <div>
          <div className="text-[#22d3ee] text-[10px] font-mono tracking-[0.22em] uppercase mb-1.5">
            Pocket Agent · Capture Inbox
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Capture Inbox</h1>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
            Everything you&apos;ve shared from your phone. Triage, keep, or discard.
          </p>
        </div>

        {/* No brain */}
        {!hasBrain && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-5 py-5 space-y-2">
            <p className="text-sm font-medium text-slate-300">No brain connected yet.</p>
            <a href="/app/onboarding" className="inline-block text-sm text-[#22d3ee] hover:underline font-mono">
              Set up brain →
            </a>
          </div>
        )}

        {/* Empty state */}
        {hasBrain && entries.length === 0 && (
          <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 px-5 py-7 flex flex-col items-center gap-3 text-center">
            <span className="text-[#22d3ee]/20 text-3xl">⇧</span>
            <p className="text-sm font-medium text-slate-400">Nothing shared in yet.</p>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xs">
              Set up the iOS Shortcut on the Share Setup page and start sending content here —
              articles, URLs, and notes from any app.
            </p>
            <a
              href="/app/share-setup"
              className="text-xs font-mono text-[#22d3ee] hover:underline mt-1"
            >
              Share Setup →
            </a>
          </div>
        )}

        {/* Feed */}
        {entries.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.14em]">
                {entries.length} item{entries.length !== 1 ? "s" : ""} · newest first
              </span>
              <a
                href="/app/share-setup"
                className="text-[10px] font-mono text-slate-600 hover:text-[#22d3ee] transition-colors"
              >
                Shortcut setup →
              </a>
            </div>

            <div className="flex flex-col gap-3">
              {entries.map((entry) => (
                <InboxRow
                  key={entry.id}
                  entry={entry}
                  onRemove={removingId !== null && removingId !== entry.id
                    ? async () => { /* another remove in flight */ }
                    : handleRemove}
                />
              ))}
            </div>
          </>
        )}

        {/* Actions footer */}
        <div className="border-t border-slate-800/40 pt-4 flex flex-col gap-2">
          <a
            href="/app/capture"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Capture (upload files)
          </a>
        </div>
      </div>
    </div>
  );
}
