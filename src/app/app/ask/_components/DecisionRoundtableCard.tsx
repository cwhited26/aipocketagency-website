"use client";

// DecisionRoundtableCard — the live + verdict surface for a Decision Roundtable, rendered inline in the
// Ask thread from an assistant message's metadata (PA-DR §9). While the debate runs it drives the
// /advance loop (one argue-round per call), streams each round's turns in, and lets the owner interject.
// When the Moderator lands it flips to the verdict view: editable synthesis + the preserved dissent +
// the supporting evidence, with Save / Reject / Run again.

import { useCallback, useEffect, useRef, useState } from "react";
import { ROLE_LABELS, type RoundtableRole, type RoundtableTurn, type Verdict } from "@/lib/decisions/types";
import type { DecisionRoundtableCardPayload } from "@/lib/decisions/card";

type Status = "running" | "verdict_ready" | "saved" | "rejected" | "cancelled";

type LoadResponse = {
  roundtable: { status: Status; total_rounds: number; verdict: string | null; verdict_brain_path: string | null };
  turns: RoundtableTurn[];
  verdict: Verdict | null;
};

type AdvanceResponse = {
  status?: Status;
  turns?: RoundtableTurn[];
  verdict?: Verdict | null;
  busy?: boolean;
  error?: string;
};

function roleColor(role: RoundtableRole): string {
  switch (role) {
    case "steelman":
      return "#22d3ee";
    case "devils_advocate":
      return "#f59e0b";
    case "domain_specialist":
      return "#a78bfa";
    case "moderator":
      return "#34d399";
    case "owner_interjection":
      return "#94a3b8";
  }
}

export default function DecisionRoundtableCard({
  payload,
  onRunAgain,
}: {
  payload: DecisionRoundtableCardPayload;
  // Re-opens the composer with the question so the owner can run a fresh roundtable with new context.
  onRunAgain?: (question: string) => void;
}) {
  const { roundtableId, question, totalRounds } = payload;
  const [status, setStatus] = useState<Status>("running");
  const [turns, setTurns] = useState<RoundtableTurn[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [editedVerdict, setEditedVerdict] = useState("");
  const [interjectText, setInterjectText] = useState("");
  const [interjecting, setInterjecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [finalNote, setFinalNote] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const mounted = useRef(true);
  const loopStarted = useRef(false);

  // One round per /advance — loop until the debate leaves the running state. Guarded so a strict-mode
  // double-mount can't double-drive it; the server's run_lock_at is the backstop against double-spend.
  const runLoop = useCallback(async () => {
    if (loopStarted.current) return;
    loopStarted.current = true;
    for (;;) {
      if (!mounted.current) return;
      let res: Response;
      try {
        res = await fetch(`/api/app/decisions/${roundtableId}/advance`, { method: "POST" });
      } catch {
        if (mounted.current) setError("Lost connection while the debate was running. Reopen the thread to resume.");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as AdvanceResponse;
      if (!res.ok) {
        if (mounted.current) setError(data.error ?? "The roundtable hit an error. You can try again.");
        return;
      }
      if (!mounted.current) return;
      if (data.turns) setTurns(data.turns);
      if (data.verdict) setVerdict(data.verdict);
      if (data.status && data.status !== "running") {
        setStatus(data.status);
        return;
      }
      // Another tab/poll holds the lock → wait briefly and re-check rather than hammering.
      if (data.busy) await new Promise((r) => setTimeout(r, 1500));
    }
  }, [roundtableId]);

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const res = await fetch(`/api/app/decisions/${roundtableId}`);
        if (!res.ok) {
          if (mounted.current) setError("Couldn't load this roundtable.");
          return;
        }
        const data = (await res.json()) as LoadResponse;
        if (!mounted.current) return;
        setStatus(data.roundtable.status);
        setTurns(data.turns);
        if (data.verdict) setVerdict(data.verdict);
        if (data.roundtable.verdict) setEditedVerdict(data.roundtable.verdict);
        if (data.roundtable.status === "running") void runLoop();
      } catch {
        if (mounted.current) setError("Couldn't load this roundtable.");
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [roundtableId, runLoop]);

  // Pre-fill the editable verdict from the Moderator's recommendation once it lands.
  useEffect(() => {
    if (verdict && !editedVerdict) setEditedVerdict(verdict.recommendation);
  }, [verdict, editedVerdict]);

  async function submitInterjection() {
    const content = interjectText.trim();
    if (!content || interjecting) return;
    setInterjecting(true);
    try {
      const res = await fetch(`/api/app/decisions/${roundtableId}/interject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = (await res.json()) as { turn: RoundtableTurn };
        setTurns((prev) => [...prev, data.turn]);
        setInterjectText("");
      }
    } catch {
      // A missed interjection isn't fatal — the debate keeps running; the owner can retype.
    } finally {
      setInterjecting(false);
    }
  }

  async function saveVerdict() {
    if (saving || !editedVerdict.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/app/decisions/${roundtableId}/verdict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", recommendation: editedVerdict.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; brainPath?: string | null; brainNote?: string | null; error?: string };
      if (res.ok && data.ok) {
        setStatus("saved");
        setFinalNote(data.brainNote ?? (data.brainPath ? `Saved to your brain at ${data.brainPath}.` : "Saved."));
      } else {
        setError(data.error ?? "Couldn't save the verdict.");
      }
    } catch {
      setError("Couldn't save the verdict.");
    } finally {
      setSaving(false);
    }
  }

  async function rejectVerdict() {
    const reason = rejectReason.trim();
    if (saving || !reason) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/app/decisions/${roundtableId}/verdict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason }),
      });
      if (res.ok) {
        setStatus("rejected");
        setFinalNote("Rejected. Your reason is logged so PA gets sharper about when to offer a roundtable.");
      } else {
        setError("Couldn't record the rejection.");
      }
    } catch {
      setError("Couldn't record the rejection.");
    } finally {
      setSaving(false);
    }
  }

  async function runAgain() {
    try {
      await fetch(`/api/app/decisions/${roundtableId}/verdict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rerun" }),
      });
    } catch {
      // Re-run is a client restart; a failed ack still lets the owner start fresh.
    }
    onRunAgain?.(question);
  }

  const argueTurns = turns.filter((t) => t.role !== "moderator");
  const roundsDone = new Set(argueTurns.filter((t) => t.role !== "owner_interjection").map((t) => t.round_index)).size;

  return (
    <div className="rounded-2xl border border-[#34d399]/25 bg-slate-900/70 overflow-hidden max-w-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/60">
        <span className="text-[#34d399] text-sm">⚖</span>
        <span className="text-[11px] font-mono tracking-[0.14em] uppercase text-[#34d399]/80 font-semibold">
          Decision Roundtable
        </span>
        <span className="ml-auto text-[10px] font-mono text-slate-500">
          {status === "running"
            ? `Round ${Math.min(roundsDone + 1, totalRounds)} of ${totalRounds}`
            : status === "verdict_ready"
            ? "Verdict ready"
            : status === "saved"
            ? "Saved"
            : status === "rejected"
            ? "Rejected"
            : "Closed"}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        <p className="text-sm text-slate-300 leading-relaxed">
          <span className="text-slate-500">Question: </span>
          {question}
        </p>

        {/* Transcript */}
        <div className="space-y-2.5">
          {turns.map((t) => (
            <div key={t.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-mono tracking-[0.1em] uppercase font-semibold"
                  style={{ color: roleColor(t.role) }}
                >
                  {ROLE_LABELS[t.role]}
                </span>
                <span className="text-[9px] font-mono text-slate-600">{t.model_backing}</span>
              </div>
              <div
                className="rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap"
                style={{
                  background: t.role === "owner_interjection" ? "rgba(148,163,184,0.08)" : "rgba(15,23,42,0.6)",
                  border: `1px solid ${roleColor(t.role)}22`,
                  color: "#cbd5e1",
                }}
              >
                {t.content}
              </div>
            </div>
          ))}

          {status === "running" && (
            <div className="flex items-center gap-2 text-[12px] text-slate-400 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
              {roundsDone >= totalRounds ? "Moderator is weighing the verdict…" : "Your agents are arguing…"}
            </div>
          )}
        </div>

        {/* Interjection — only while the debate is live */}
        {status === "running" && (
          <div className="flex items-end gap-2 pt-1">
            <textarea
              rows={1}
              value={interjectText}
              onChange={(e) => setInterjectText(e.target.value)}
              placeholder="Jump in — add context or redirect an agent…"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-[#34d399]/40 focus:outline-none resize-none"
            />
            <button
              onClick={submitInterjection}
              disabled={!interjectText.trim() || interjecting}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-[12px] font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              Send
            </button>
          </div>
        )}

        {/* Verdict view */}
        {(status === "verdict_ready" || status === "saved") && verdict && (
          <div className="space-y-3 pt-2 border-t border-slate-800/60">
            <div>
              <p className="text-[10px] font-mono tracking-[0.12em] uppercase text-[#34d399]/80 mb-1.5">
                Verdict {status === "verdict_ready" && "— edit before you save"}
              </p>
              {status === "saved" ? (
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{editedVerdict}</p>
              ) : (
                <textarea
                  rows={4}
                  value={editedVerdict}
                  onChange={(e) => setEditedVerdict(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-[13px] text-slate-100 focus:border-[#34d399]/40 focus:outline-none resize-y leading-relaxed"
                />
              )}
            </div>

            {verdict.strongestDissent && (
              <div>
                <p className="text-[10px] font-mono tracking-[0.12em] uppercase text-amber-400/80 mb-1">
                  Strongest dissent
                </p>
                <p className="text-[13px] text-slate-400 leading-relaxed">{verdict.strongestDissent}</p>
              </div>
            )}
            {verdict.supportingEvidence && (
              <div>
                <p className="text-[10px] font-mono tracking-[0.12em] uppercase text-slate-500 mb-1">
                  Supporting evidence
                </p>
                <p className="text-[13px] text-slate-400 leading-relaxed">{verdict.supportingEvidence}</p>
              </div>
            )}

            {status === "verdict_ready" && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={saveVerdict}
                  disabled={saving || !editedVerdict.trim()}
                  className="rounded-lg bg-[#34d399] px-4 py-2 text-[13px] font-semibold text-[#04231a] hover:bg-[#10b981] disabled:opacity-40 transition-colors"
                >
                  {saving ? "Saving…" : "Save to brain"}
                </button>
                <button
                  onClick={() => setRejectOpen((v) => !v)}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-[13px] text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Reject with reason
                </button>
                <button
                  onClick={runAgain}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-[13px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Run again with new context
                </button>
              </div>
            )}

            {rejectOpen && status === "verdict_ready" && (
              <div className="flex items-end gap-2">
                <textarea
                  rows={1}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Why are you rejecting this verdict?"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none"
                />
                <button
                  onClick={rejectVerdict}
                  disabled={saving || !rejectReason.trim()}
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        )}

        {finalNote && <p className="text-[12px] text-[#34d399]/80 pt-1">{finalNote}</p>}
        {status === "rejected" && !finalNote && (
          <p className="text-[12px] text-slate-500 pt-1">This verdict was rejected.</p>
        )}
        {error && <p className="text-[12px] text-amber-300/80 pt-1">{error}</p>}
      </div>
    </div>
  );
}
