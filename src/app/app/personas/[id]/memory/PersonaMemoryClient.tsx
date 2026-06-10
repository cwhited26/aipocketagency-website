"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

// The owner-facing memory inspector (PA-MEM-5). Five accordion sections — one per partition, with the
// owner-friendly labels the SPEC locks (§4.1) — per-row supersede/delete, a "forget everything about
// [Contact]" filter, and a top-level "forget everything" behind an explicit confirm. The internal
// partition names never reach this surface.

type MemoryPartition = "working" | "episodic" | "semantic" | "procedural" | "model_of_you";
type MemoryTier = "session" | "persona" | "global";

type MemoryView = {
  id: string;
  partition: MemoryPartition;
  tier: MemoryTier;
  body: string;
  importance: number;
  contactRef: string | null;
  untrustedOrigin: boolean;
  conversationId: string | null;
  createdAt: string;
};

type MemoryResponse = {
  personaName: string;
  memories: MemoryView[];
  contacts: string[];
  tier: string;
  cap: number | null;
  liveCountAcrossPersonas: number | null;
  provisioned: boolean;
};

const PARTITION_ORDER: MemoryPartition[] = [
  "model_of_you",
  "semantic",
  "procedural",
  "episodic",
  "working",
];

const PARTITION_LABELS: Record<MemoryPartition, string> = {
  working: "What you're working on",
  episodic: "Past conversations",
  semantic: "What it learned",
  procedural: "What works for you",
  model_of_you: "How you work",
};

const PARTITION_BLURBS: Record<MemoryPartition, string> = {
  working: "The thread it's holding right now.",
  episodic: "What past conversations covered, and what got decided.",
  semantic: "Facts it picked up that aren't in your brain yet — a preference, a quirk, an objection.",
  procedural: "Moves that worked — its playbook for how you like things done.",
  model_of_you: "How you talk and decide, so it sounds like your side of the desk.",
};

const TIER_LABELS: Record<MemoryTier, string> = {
  session: "This conversation",
  persona: "This assistant",
  global: "Everywhere",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function PersonaMemoryClient({ personaId }: { personaId: string }) {
  const [data, setData] = useState<MemoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeContact, setActiveContact] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<MemoryPartition>>(new Set(PARTITION_ORDER));
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmForgetAll, setConfirmForgetAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/personas/${personaId}/memory`, { cache: "no-store" });
      const body = (await res.json()) as MemoryResponse & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Couldn't load memory (${res.status})`);
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load memory");
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const all = data?.memories ?? [];
    return activeContact ? all.filter((m) => m.contactRef === activeContact) : all;
  }, [data, activeContact]);

  const byPartition = useMemo(() => {
    const map = new Map<MemoryPartition, MemoryView[]>();
    for (const p of PARTITION_ORDER) map.set(p, []);
    for (const m of visible) map.get(m.partition)?.push(m);
    return map;
  }, [visible]);

  function toggle(partition: MemoryPartition) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(partition)) next.delete(partition);
      else next.add(partition);
      return next;
    });
  }

  function dropLocally(predicate: (m: MemoryView) => boolean) {
    setData((prev) => (prev ? { ...prev, memories: prev.memories.filter((m) => !predicate(m)) } : prev));
  }

  async function rowAction(memoryId: string, action: "supersede" | "delete") {
    setBusy(memoryId);
    setError(null);
    try {
      const res = await fetch(`/api/app/personas/${personaId}/memory/${memoryId}`, {
        method: action === "delete" ? "DELETE" : "POST",
        cache: "no-store",
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Request failed (${res.status})`);
      }
      dropLocally((m) => m.id === memoryId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function forget(scope: { contact?: string }) {
    setBusy(scope.contact ? `contact:${scope.contact}` : "all");
    setError(null);
    try {
      const res = await fetch(`/api/app/personas/${personaId}/memory/forget-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, ...(scope.contact ? { contact: scope.contact } : {}) }),
        cache: "no-store",
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Request failed (${res.status})`);
      }
      if (scope.contact) {
        dropLocally((m) => m.contactRef === scope.contact);
        setActiveContact(null);
      } else {
        setData((prev) => (prev ? { ...prev, memories: [], contacts: [] } : prev));
        setConfirmForgetAll(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const totalVisible = visible.length;

  return (
    <div className="h-full overflow-y-auto bg-[#05070a]">
      <div className="max-w-2xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
        <div className="mb-2">
          <Link
            href={`/app/personas/${personaId}`}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Back to assistant
          </Link>
        </div>

        <div className="mb-6">
          <div className="text-[10px] text-[#22d3ee]/60 font-mono tracking-[0.2em] uppercase mb-2">
            Memory
          </div>
          <h1 className="text-2xl font-bold text-slate-100">
            What {data?.personaName ?? "this assistant"} remembers about you
          </h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Context it&apos;s picked up working with you, on top of your brain. You can read every line,
            retire one, or wipe it. Nothing here is shared with anyone but you.
          </p>
          {data?.cap !== undefined && (
            <p className="text-slate-600 text-xs mt-2 font-mono">
              {data?.cap === null
                ? "Unlimited memories on your plan."
                : `Using ${data?.liveCountAcrossPersonas ?? 0} of ${data?.cap} memories across your assistants.`}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm font-mono text-slate-500">loading what it knows…</p>
        ) : !data || data.memories.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-10 text-center">
            <p className="text-slate-300 text-sm">It hasn&apos;t learned anything about you yet.</p>
            <p className="text-slate-600 text-xs mt-2">
              As you work with this assistant, what it picks up shows up here for you to keep or kill.
            </p>
          </div>
        ) : (
          <>
            {/* Contact filter — the "what it learned about [Contact]" lookup */}
            {data.contacts.length > 0 && (
              <div className="mb-6">
                <div className="text-[11px] text-slate-500 font-mono mb-2">Filter by who it&apos;s about</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setActiveContact(null)}
                    className={[
                      "min-h-[36px] px-3 rounded-lg text-xs font-mono border transition-colors",
                      activeContact === null
                        ? "border-[#22d3ee]/40 bg-[#22d3ee]/10 text-[#22d3ee]"
                        : "border-slate-700/60 text-slate-400 hover:text-slate-200",
                    ].join(" ")}
                  >
                    [ everyone ]
                  </button>
                  {data.contacts.map((c) => (
                    <button
                      key={c}
                      onClick={() => setActiveContact(c)}
                      className={[
                        "min-h-[36px] px-3 rounded-lg text-xs font-mono border transition-colors",
                        activeContact === c
                          ? "border-[#22d3ee]/40 bg-[#22d3ee]/10 text-[#22d3ee]"
                          : "border-slate-700/60 text-slate-400 hover:text-slate-200",
                      ].join(" ")}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {activeContact && (
                  <button
                    onClick={() => void forget({ contact: activeContact })}
                    disabled={busy === `contact:${activeContact}`}
                    className="mt-3 min-h-[40px] rounded-xl border border-red-500/30 px-4 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                  >
                    {busy === `contact:${activeContact}`
                      ? "Forgetting…"
                      : `Forget everything about ${activeContact}`}
                  </button>
                )}
              </div>
            )}

            {/* Five partition accordions */}
            <div className="flex flex-col gap-3">
              {PARTITION_ORDER.map((partition) => {
                const rows = byPartition.get(partition) ?? [];
                const isOpen = expanded.has(partition);
                return (
                  <section
                    key={partition}
                    className="rounded-2xl border border-slate-800/60 bg-slate-900/40 overflow-hidden"
                  >
                    <button
                      onClick={() => toggle(partition)}
                      className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left"
                    >
                      <div>
                        <div className="text-[15px] font-semibold text-slate-100">
                          {PARTITION_LABELS[partition]}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{PARTITION_BLURBS[partition]}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono text-slate-500">{rows.length}</span>
                        <span className="text-slate-600 text-sm">{isOpen ? "▾" : "▸"}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 sm:px-5 pb-4 flex flex-col gap-2.5">
                        {rows.length === 0 ? (
                          <p className="text-xs text-slate-600 py-2">Nothing here yet.</p>
                        ) : (
                          rows.map((m) => (
                            <div
                              key={m.id}
                              className="rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3"
                            >
                              <p className="text-sm text-slate-200 leading-relaxed">{m.body}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-600">
                                <span>learned {relativeTime(m.createdAt)}</span>
                                <span>· {TIER_LABELS[m.tier]}</span>
                                <span>· importance {m.importance}/10</span>
                                {m.contactRef && <span>· about {m.contactRef}</span>}
                                {m.untrustedOrigin && (
                                  <span className="text-amber-400/70">· from a shared capture</span>
                                )}
                              </div>
                              <div className="mt-2.5 flex items-center gap-2">
                                <button
                                  onClick={() => void rowAction(m.id, "supersede")}
                                  disabled={busy === m.id}
                                  className="min-h-[36px] rounded-lg border border-slate-700/60 px-3 text-xs text-slate-300 hover:border-slate-500 hover:text-slate-100 disabled:opacity-50 transition-colors"
                                >
                                  {busy === m.id ? "…" : "Retire"}
                                </button>
                                <button
                                  onClick={() => void rowAction(m.id, "delete")}
                                  disabled={busy === m.id}
                                  className="min-h-[36px] rounded-lg border border-slate-700/60 px-3 text-xs text-slate-400 hover:border-red-500/50 hover:text-red-300 disabled:opacity-50 transition-colors"
                                >
                                  {busy === m.id ? "…" : "Delete"}
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            {activeContact && totalVisible === 0 && (
              <p className="mt-4 text-sm text-slate-500">Nothing left about {activeContact}.</p>
            )}

            {/* The nuclear button */}
            <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/[0.03] px-4 sm:px-5 py-4">
              <div className="text-sm font-semibold text-slate-200">Forget everything</div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Wipes every memory this assistant holds about you. It starts fresh from your brain and
                spec. This can&apos;t be undone.
              </p>
              {confirmForgetAll ? (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => void forget({})}
                    disabled={busy === "all"}
                    className="min-h-[40px] rounded-xl bg-red-500/15 border border-red-500/40 px-4 text-sm font-medium text-red-300 hover:bg-red-500/25 disabled:opacity-50 transition-colors"
                  >
                    {busy === "all" ? "Forgetting…" : "Yes, forget everything"}
                  </button>
                  <button
                    onClick={() => setConfirmForgetAll(false)}
                    disabled={busy === "all"}
                    className="min-h-[40px] rounded-xl border border-slate-700/60 px-4 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmForgetAll(true)}
                  className="mt-3 min-h-[40px] rounded-xl border border-red-500/30 px-4 text-sm text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  Forget everything
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
