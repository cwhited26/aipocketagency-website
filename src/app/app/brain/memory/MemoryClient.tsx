"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Tier = "work" | "knowledge" | "learning";
type MemoryEntry = { path: string; name: string; tier: Tier | null };

// UI labels — internal folders are memory/work, memory/knowledge, memory/learning.
const TIER_TABS: { tier: Tier; label: string; blurb: string }[] = [
  { tier: "work", label: "Active work", blurb: "In-flight task state — the things you're working on right now." },
  { tier: "knowledge", label: "Knowledge", blurb: "Durable facts — people, companies, research, pricing." },
  { tier: "learning", label: "Patterns", blurb: "Lessons and playbooks distilled from past work." },
];

const TIER_LABEL: Record<Tier, string> = {
  work: "Active work",
  knowledge: "Knowledge",
  learning: "Patterns",
};

export default function MemoryClient({ hasGithubToken }: { hasGithubToken: boolean }) {
  const [entries, setEntries] = useState<MemoryEntry[] | null>(null);
  const [active, setActive] = useState<Tier | "untiered">("work");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState<MemoryEntry | null>(null);
  const [openContent, setOpenContent] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadList() {
    try {
      const res = await fetch("/api/app/brain/memory");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = (await res.json()) as { entries: MemoryEntry[] };
      setEntries(data.entries);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load memory");
      setEntries([]);
    }
  }

  useEffect(() => {
    void loadList();
  }, []);

  async function openEntry(entry: MemoryEntry) {
    setOpen(entry);
    setOpenContent(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/app/brain/memory?path=${encodeURIComponent(entry.path)}`);
      if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
      const data = (await res.json()) as { content: string };
      setOpenContent(data.content);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to load file");
      setOpenContent("");
    }
  }

  async function moveTo(tier: Tier) {
    if (!open) return;
    setMoving(true);
    setActionError(null);
    try {
      const res = await fetch("/api/app/brain/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromPath: open.path, toTier: tier }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Move failed (${res.status})`);
      }
      setOpen(null);
      setOpenContent(null);
      await loadList();
      setActive(tier);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Move failed");
    } finally {
      setMoving(false);
    }
  }

  if (!hasGithubToken) {
    return (
      <Shell>
        <p className="text-sm text-slate-400">
          Connect GitHub to organize your memory into tiers.{" "}
          <a href="/api/app/auth/github?next=/app/brain/memory" className="text-[#22d3ee] hover:underline">
            Connect GitHub →
          </a>
        </p>
      </Shell>
    );
  }

  const untiered = (entries ?? []).filter((e) => e.tier === null);
  const visible =
    active === "untiered"
      ? untiered
      : (entries ?? []).filter((e) => e.tier === active);

  return (
    <Shell>
      {/* Tier subtabs */}
      <div className="flex flex-wrap gap-1.5">
        {TIER_TABS.map((t) => {
          const count = (entries ?? []).filter((e) => e.tier === t.tier).length;
          return (
            <button
              key={t.tier}
              onClick={() => setActive(t.tier)}
              className={`rounded-lg px-3 py-2 text-xs font-mono transition-all ${
                active === t.tier
                  ? "bg-[#22d3ee]/15 border border-[#22d3ee]/40 text-[#22d3ee]"
                  : "border border-slate-700/60 bg-slate-800/40 text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
        {untiered.length > 0 && (
          <button
            onClick={() => setActive("untiered")}
            className={`rounded-lg px-3 py-2 text-xs font-mono transition-all ${
              active === "untiered"
                ? "bg-amber-500/15 border border-amber-500/40 text-amber-300"
                : "border border-slate-700/60 bg-slate-800/40 text-slate-400 hover:text-slate-200"
            }`}
          >
            Untiered <span className="opacity-60">{untiered.length}</span>
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {active === "untiered"
          ? "Legacy memories from before tiers existed. Open one to file it into a tier."
          : TIER_TABS.find((t) => t.tier === active)?.blurb}
      </p>

      {/* List */}
      {entries === null ? (
        <p className="text-[12px] font-mono text-slate-500">loading memory…</p>
      ) : loadError ? (
        <p className="text-xs text-red-400">{loadError}</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-6 text-center">
          <p className="text-sm text-slate-300 font-semibold">Nothing here yet</p>
          <p className="text-xs text-slate-500 mt-1">
            {active === "untiered"
              ? "All your memories are filed into tiers."
              : "New memories your agent saves get classified into this tier automatically."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map((entry) => (
            <button
              key={entry.path}
              onClick={() => openEntry(entry)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg border border-slate-700/50 bg-slate-900/50 hover:bg-slate-800/60 hover:border-slate-600/60 transition-all text-left group"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-200 group-hover:text-slate-100 block truncate">
                  {entry.name}
                </span>
                <span className="text-[10px] font-mono text-slate-600 block truncate">{entry.path}</span>
              </div>
              <span className="text-slate-600 group-hover:text-slate-400 text-xs shrink-0">→</span>
            </button>
          ))}
        </div>
      )}

      {/* Open entry modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setOpen(null)}>
          <div
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl border border-slate-700/60 bg-[#0b1117] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
              <span className="text-sm font-semibold text-slate-100 truncate">{open.name}</span>
              <button onClick={() => setOpen(null)} className="text-slate-500 hover:text-slate-200 px-2">✕</button>
            </div>

            <div className="px-4 py-3 border-b border-slate-800/60 flex flex-col gap-2">
              <span className="text-[11px] font-mono text-slate-500">
                Tier: {open.tier ? TIER_LABEL[open.tier] : "Untiered"}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-mono text-slate-400">Move to…</span>
                {TIER_TABS.map((t) => (
                  <button
                    key={t.tier}
                    onClick={() => moveTo(t.tier)}
                    disabled={moving || open.tier === t.tier}
                    className="rounded-md border border-slate-700/60 bg-slate-800/60 px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:bg-slate-700/60 disabled:opacity-40"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {actionError && <p className="text-xs text-red-400">{actionError}</p>}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {openContent === null ? (
                <p className="text-[12px] font-mono text-slate-500">loading…</p>
              ) : (
                <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {openContent || "(empty file)"}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-7 flex flex-col gap-5">
        <div>
          <Link href="/app/brain" className="text-[11px] font-mono text-slate-500 hover:text-slate-300">
            ← Brain
          </Link>
          <h1 className="text-lg font-semibold text-slate-100 mt-2">Memory</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Your agent&apos;s memory, organized into tiers so the right context surfaces at the right time.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
