"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

// The owner-facing Soul surface (Soul System SPEC §Owner controls). One accordion section per attribute
// kind, with per-row Edit / Lock / Forget, a manual-add form, and a free-form "Suggest improvements"
// box that fires the extractor. Every attribute is in plain English — the owner should read their Soul
// and recognise themselves. Mirrors the persona-memory inspector's look.

type SoulKind =
  | "communication_style"
  | "response_preference"
  | "conversational_rhythm"
  | "boundary"
  | "surface_preference"
  | "working_dynamic"
  | "affective_signal";

type SoulView = {
  id: string;
  kind: SoulKind;
  summary: string;
  body: string | null;
  confidence: number;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
};

type SoulResponse = {
  personaName: string;
  attributes: SoulView[];
  tier: string;
  extractionMode: "off" | "opt_in" | "full";
  canSuggest: boolean;
  cap: number | null;
  liveCount: number;
  provisioned: boolean;
};

const KIND_ORDER: SoulKind[] = [
  "communication_style",
  "response_preference",
  "surface_preference",
  "conversational_rhythm",
  "working_dynamic",
  "affective_signal",
  "boundary",
];

const KIND_LABELS: Record<SoulKind, string> = {
  communication_style: "Communication style",
  response_preference: "Response preferences",
  conversational_rhythm: "Check-in rhythm",
  boundary: "Boundaries (do not violate)",
  surface_preference: "Formatting & surfaces",
  working_dynamic: "Working dynamic",
  affective_signal: "Reading your state",
};

const KIND_BLURBS: Record<SoulKind, string> = {
  communication_style: "Formal or casual, terse or verbose, direct or soft.",
  response_preference: "Preferred length and shape — bullets vs prose, examples vs principles.",
  conversational_rhythm: "When to check in, when to interrupt, when to hold.",
  boundary: "Lines you've drawn — 'don't do that', 'always ask first'.",
  surface_preference: "How to format drafts, default apps, the shorthand you use.",
  working_dynamic: "When you trust it to run vs review every step.",
  affective_signal: "How to tell when you're busy, stressed, or in flow.",
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

export default function PersonaSoulClient({ personaId }: { personaId: string }) {
  const [data, setData] = useState<SoulResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editSummary, setEditSummary] = useState("");
  const [editBody, setEditBody] = useState("");

  // Suggest box
  const [note, setNote] = useState("");
  const [suggesting, setSuggesting] = useState(false);

  // Manual add
  const [addKind, setAddKind] = useState<SoulKind>("communication_style");
  const [addSummary, setAddSummary] = useState("");
  const [addBody, setAddBody] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/personas/${personaId}/soul`, { cache: "no-store" });
      const body = (await res.json()) as SoulResponse & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Couldn't load the Soul (${res.status})`);
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the Soul");
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const byKind = useMemo(() => {
    const map = new Map<SoulKind, SoulView[]>();
    for (const k of KIND_ORDER) map.set(k, []);
    for (const a of data?.attributes ?? []) map.get(a.kind)?.push(a);
    return map;
  }, [data]);

  function dropLocally(id: string) {
    setData((prev) => (prev ? { ...prev, attributes: prev.attributes.filter((a) => a.id !== id) } : prev));
  }

  function patchLocally(id: string, patch: Partial<SoulView>) {
    setData((prev) =>
      prev ? { ...prev, attributes: prev.attributes.map((a) => (a.id === id ? { ...a, ...patch } : a)) } : prev,
    );
  }

  async function forget(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/app/personas/${personaId}/soul/${id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Request failed (${res.status})`);
      }
      dropLocally(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function toggleLock(a: SoulView) {
    setBusy(a.id);
    setError(null);
    try {
      const res = await fetch(`/api/app/personas/${personaId}/soul/${a.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !a.locked }),
        cache: "no-store",
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Request failed (${res.status})`);
      }
      patchLocally(a.id, { locked: !a.locked });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  function startEdit(a: SoulView) {
    setEditing(a.id);
    setEditSummary(a.summary);
    setEditBody(a.body ?? "");
  }

  async function saveEdit(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/app/personas/${personaId}/soul/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: editSummary.trim(), body: editBody.trim() || null }),
        cache: "no-store",
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Request failed (${res.status})`);
      }
      patchLocally(id, { summary: editSummary.trim(), body: editBody.trim() || null });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function submitSuggest() {
    if (!note.trim()) return;
    setSuggesting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/app/personas/${personaId}/soul/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
        cache: "no-store",
      });
      const b = (await res.json().catch(() => ({}))) as {
        error?: string;
        written?: number;
        staged?: number;
        total?: number;
        reason?: string;
      };
      if (!res.ok) throw new Error(b.error ?? `Request failed (${res.status})`);
      if (typeof b.total === "number" && b.total === 0) {
        setNotice("Nothing clear enough to keep from that — try being more specific.");
      } else {
        const parts: string[] = [];
        if (b.written) parts.push(`${b.written} added`);
        if (b.staged) parts.push(`${b.staged} sent to your Inbox to approve`);
        setNotice(parts.length ? parts.join(", ") + "." : "Captured.");
      }
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSuggesting(false);
    }
  }

  async function submitAdd() {
    if (!addSummary.trim()) return;
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/app/personas/${personaId}/soul`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: addKind, summary: addSummary.trim(), body: addBody.trim() || undefined }),
        cache: "no-store",
      });
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(b.error ?? `Request failed (${res.status})`);
      setAddSummary("");
      setAddBody("");
      setNotice("Added to the Soul.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

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
            Soul
          </div>
          <h1 className="text-2xl font-bold text-slate-100">
            How {data?.personaName ?? "this assistant"} works with you
          </h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Not facts about you — the <span className="text-slate-300">how</span>: your style, the shape
            of replies you like, the lines it shouldn&apos;t cross. It picks this up as you work together.
            Read every line, fix one, lock the ones that should never change, or forget any of it.
          </p>
          {data && (
            <p className="text-slate-600 text-xs mt-2 font-mono">
              {data.extractionMode === "off"
                ? "Learning is off on your plan — add attributes by hand below."
                : data.extractionMode === "opt_in"
                  ? "Learning is on for this assistant once it has its first attribute."
                  : "Learning continuously across this assistant."}
              {data.cap === null
                ? " · unlimited"
                : ` · ${data.liveCount}/${data.cap} attributes`}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-5 rounded-xl border border-[#22d3ee]/30 bg-[#22d3ee]/5 px-4 py-3 text-sm text-[#67e8f9]">
            {notice}
          </div>
        )}

        {loading ? (
          <p className="text-sm font-mono text-slate-500">loading its Soul…</p>
        ) : (
          <>
            {(data?.attributes.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-10 text-center">
                <p className="text-slate-300 text-sm">It hasn&apos;t learned how you work yet.</p>
                <p className="text-slate-600 text-xs mt-2">
                  As you approve and reject its work, what it learns about your style shows up here — or
                  teach it directly below.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {KIND_ORDER.map((kind) => {
                  const rows = byKind.get(kind) ?? [];
                  if (rows.length === 0) return null;
                  return (
                    <section
                      key={kind}
                      className="rounded-2xl border border-slate-800/60 bg-slate-900/40 overflow-hidden"
                    >
                      <div className="px-4 sm:px-5 pt-4">
                        <div className="text-[15px] font-semibold text-slate-100">{KIND_LABELS[kind]}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{KIND_BLURBS[kind]}</div>
                      </div>
                      <div className="px-4 sm:px-5 py-4 flex flex-col gap-2.5">
                        {rows.map((a) => (
                          <div
                            key={a.id}
                            className="rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3"
                          >
                            {editing === a.id ? (
                              <div className="flex flex-col gap-2">
                                <input
                                  value={editSummary}
                                  onChange={(e) => setEditSummary(e.target.value)}
                                  maxLength={240}
                                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                                />
                                <textarea
                                  value={editBody}
                                  onChange={(e) => setEditBody(e.target.value)}
                                  maxLength={4000}
                                  rows={2}
                                  placeholder="Optional detail or example"
                                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-300"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => void saveEdit(a.id)}
                                    disabled={busy === a.id || !editSummary.trim()}
                                    className="min-h-[36px] rounded-lg bg-[#22d3ee] text-[#06222a] px-3 text-xs font-semibold hover:bg-[#67e8f9] disabled:opacity-50 transition-colors"
                                  >
                                    {busy === a.id ? "…" : "Save"}
                                  </button>
                                  <button
                                    onClick={() => setEditing(null)}
                                    disabled={busy === a.id}
                                    className="min-h-[36px] rounded-lg border border-slate-700/60 px-3 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm text-slate-200 leading-relaxed">{a.summary}</p>
                                {a.body && (
                                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{a.body}</p>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-600">
                                  <span>learned {relativeTime(a.createdAt)}</span>
                                  <span>· {Math.round(a.confidence * 100)}% sure</span>
                                  {a.locked && <span className="text-[#67e8f9]/70">· 🔒 locked</span>}
                                </div>
                                <div className="mt-2.5 flex items-center gap-2">
                                  <button
                                    onClick={() => startEdit(a)}
                                    disabled={busy === a.id}
                                    className="min-h-[36px] rounded-lg border border-slate-700/60 px-3 text-xs text-slate-300 hover:border-slate-500 hover:text-slate-100 disabled:opacity-50 transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => void toggleLock(a)}
                                    disabled={busy === a.id}
                                    className="min-h-[36px] rounded-lg border border-slate-700/60 px-3 text-xs text-slate-300 hover:border-slate-500 hover:text-slate-100 disabled:opacity-50 transition-colors"
                                  >
                                    {busy === a.id ? "…" : a.locked ? "Unlock" : "Lock"}
                                  </button>
                                  <button
                                    onClick={() => void forget(a.id)}
                                    disabled={busy === a.id}
                                    className="min-h-[36px] rounded-lg border border-slate-700/60 px-3 text-xs text-slate-400 hover:border-red-500/50 hover:text-red-300 disabled:opacity-50 transition-colors"
                                  >
                                    {busy === a.id ? "…" : "Forget"}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {/* Suggest improvements — the free-form note that fires the extractor */}
            <div className="mt-8 rounded-2xl border border-slate-800/60 bg-slate-900/40 px-4 sm:px-5 py-4">
              <div className="text-sm font-semibold text-slate-200">Suggest improvements</div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Tell it how you want to be worked with, in your own words. It&apos;ll turn that into Soul
                attributes — high-confidence ones land here, the rest go to your Inbox to approve.
              </p>
              {data?.canSuggest ? (
                <div className="mt-3 flex flex-col gap-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={4000}
                    rows={3}
                    placeholder="e.g. You're too apologetic — cut the 'I think' from your drafts and just say it."
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
                  />
                  <button
                    onClick={() => void submitSuggest()}
                    disabled={suggesting || !note.trim()}
                    className="self-start min-h-[40px] rounded-xl bg-[#22d3ee] text-[#06222a] text-sm font-semibold px-4 hover:bg-[#67e8f9] disabled:opacity-50 transition-colors"
                  >
                    {suggesting ? "Reading…" : "Teach it"}
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-600">
                  This is a Business Agent feature. On your plan, add attributes by hand below.
                </p>
              )}
            </div>

            {/* Manual add — allowed on every tier */}
            <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-900/40 px-4 sm:px-5 py-4">
              <div className="text-sm font-semibold text-slate-200">Add one by hand</div>
              <div className="mt-3 flex flex-col gap-2">
                <select
                  value={addKind}
                  onChange={(e) => setAddKind(e.target.value as SoulKind)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
                >
                  {KIND_ORDER.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <input
                  value={addSummary}
                  onChange={(e) => setAddSummary(e.target.value)}
                  maxLength={240}
                  placeholder="One line, your voice — e.g. Keep replies under five sentences."
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
                />
                <textarea
                  value={addBody}
                  onChange={(e) => setAddBody(e.target.value)}
                  maxLength={4000}
                  rows={2}
                  placeholder="Optional detail or example"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-300"
                />
                <button
                  onClick={() => void submitAdd()}
                  disabled={adding || !addSummary.trim()}
                  className="self-start min-h-[40px] rounded-xl border border-slate-700 px-4 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-50 transition-colors"
                >
                  {adding ? "Adding…" : "Add attribute"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
