"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Mascot from "@/components/Mascot";
import { affordancesFor, type InboxItemKind } from "@/lib/inbox-affordances";
import type {
  LedgerStatus,
  MissionControlSnapshot,
  RunLedgerEntry,
  ScheduledEntry,
} from "@/lib/mission-control/projection";

// Mission Control — the unified live pane (PA-MC-1). One screen for everything the agent fleet
// is running, scheduled, or waiting on you for, sectioned by urgency: Attention → Active right
// now → Awaiting your decision → Scheduled → Done. Refetches every 8s while the tab is focused
// (paused on blur via the Page Visibility API) so the pane stays live without a manual reload.

// ─── Shared inbox-card model (unchanged from the old Inbox queue) ──────────────

type TriageDetail = {
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  url: string;
  receivedAt: string | null;
  inReplyTo: string;
};

type ActionApprovalDetail = {
  connector: string;
  action: string;
  subAgentRunId: string | null;
};

type InboxCard = {
  id: string;
  system: "inbox" | "legacy";
  kind: InboxItemKind;
  status: "pending" | "approved" | "rejected" | "expired" | "failed";
  title: string;
  source: string;
  preview: string;
  bodyMd: string;
  createdAt: string;
  resolvedAt: string | null;
  email: { to: string; subject: string; body: string } | null;
  triage: TriageDetail | null;
  action: ActionApprovalDetail | null;
  sourceSurface: string | null;
  threadId: string | null;
};

type InboxResponse = { cards: InboxCard[]; provisioned: boolean };
type MissionControlResponse = MissionControlSnapshot & { runsProvisioned: boolean };

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Countdown to a future ISO time, for the Scheduled section ("in 3h 12m" / "due now").
function countdownTo(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return "due now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `in ${days}d ${hrs % 24}h`;
}

function approveEndpoint(card: InboxCard): string {
  return card.system === "legacy"
    ? `/api/app/actions/${card.id}/approve`
    : `/api/app/inbox/${card.id}/approve`;
}

function rejectEndpoint(card: InboxCard): string {
  return card.system === "legacy"
    ? `/api/app/actions/${card.id}/reject`
    : `/api/app/inbox/${card.id}/reject`;
}

async function postDecision(url: string): Promise<void> {
  const res = await fetch(url, { method: "POST", cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
}

// Which "Awaiting your decision" sub-section a kind renders in. Exhaustive with a `never` guard.
type AwaitingSection = "triage" | "actions" | "drafts" | "decisions" | "briefs" | "activity" | "hidden";

function sectionFor(kind: InboxItemKind): AwaitingSection {
  switch (kind) {
    case "email_triage":
      return "triage";
    case "action_approval":
      return "actions";
    case "draft":
      return "drafts";
    case "decision":
      return "decisions";
    case "routine_output":
      return "briefs";
    case "sub_agent_activity":
      return "activity";
    case "persona_lead":
      return "hidden";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

// ─── Count-up hook (PA-MC-3) ──────────────────────────────────────────────────

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Eased count-up from the last displayed value to the new target. Respects reduced-motion (jumps
// straight to the target). Drives the header stat tiles when live counts change.
function useCountUp(value: number, durationMs = 600): number {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);

  useEffect(() => {
    const from = displayRef.current;
    if (from === value) return;
    if (prefersReducedMotion()) {
      displayRef.current = value;
      setDisplay(value);
      return;
    }
    let raf = 0;
    let start = 0;
    const step = (ts: number) => {
      if (start === 0) start = ts;
      const t = Math.min(1, (ts - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (value - from) * eased);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return display;
}

// ─── Stat tile strip ──────────────────────────────────────────────────────────

type TileTone = "amber" | "cyan" | "violet" | "blue" | "emerald" | "muted";

const TILE_TONE: Record<TileTone, { value: string; label: string; ring: string }> = {
  amber: { value: "text-amber-300", label: "text-amber-400/70", ring: "border-amber-500/30" },
  cyan: { value: "text-[#22d3ee]", label: "text-[#22d3ee]/60", ring: "border-[#22d3ee]/25" },
  violet: { value: "text-violet-300", label: "text-violet-300/60", ring: "border-violet-500/25" },
  blue: { value: "text-sky-300", label: "text-sky-300/60", ring: "border-sky-500/25" },
  emerald: { value: "text-emerald-300", label: "text-emerald-400/60", ring: "border-emerald-500/25" },
  muted: { value: "text-slate-300", label: "text-slate-500", ring: "border-slate-700/50" },
};

function StatTile({ count, label, tone }: { count: number; label: string; tone: TileTone }) {
  const shown = useCountUp(count);
  const t = TILE_TONE[tone];
  return (
    <div className={`rounded-xl border ${t.ring} bg-slate-900/50 px-2.5 py-3 text-center`}>
      <div className={`text-xl sm:text-2xl font-bold tabular-nums ${t.value}`}>{shown}</div>
      <div className={`mt-0.5 text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.12em] ${t.label}`}>
        {label}
      </div>
    </div>
  );
}

function StatStrip({ counts }: { counts: MissionControlSnapshot["counts"] }) {
  const tiles: { key: string; label: string; tone: TileTone; count: number }[] = [
    { key: "attention", label: "Attention", tone: "amber", count: counts.attention },
    { key: "active", label: "Active", tone: "cyan", count: counts.active },
    { key: "verifying", label: "Verifying", tone: "violet", count: counts.verifying },
    { key: "scheduled", label: "Scheduled", tone: "blue", count: counts.scheduled },
    { key: "done", label: "Done", tone: "emerald", count: counts.done },
    { key: "idle", label: "Idle", tone: "muted", count: counts.idle },
  ];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-8">
      {tiles.map((tile) => (
        <StatTile key={tile.key} count={tile.count} label={tile.label} tone={tile.tone} />
      ))}
    </div>
  );
}

// ─── Attention card (failed / zombie / needs-human runs) ───────────────────────

const LEDGER_LABEL: Record<LedgerStatus, string> = {
  running: "Running",
  verifying: "Verifying",
  blocked: "Parked for your decision",
  zombie: "Lost contact — no heartbeat",
  failed: "Failed",
  done: "Done",
};

function AttentionRunCard({ entry }: { entry: RunLedgerEntry }) {
  // needs_human (PA-MC-5) gets the amber "Parked for your decision" treatment; zombie/failed are
  // amber-accented too — every Attention item is something the machine has stopped progressing on.
  const label = entry.needsHuman ? "Parked for your decision" : LEDGER_LABEL[entry.ledgerStatus];
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] font-mono text-amber-400/80 uppercase tracking-[0.18em]">
          {entry.slot} · {label}
        </span>
        <span className="text-[11px] text-slate-600 shrink-0">{relativeTime(entry.updatedAt)}</span>
      </div>

      <p className="text-[15px] font-semibold text-slate-100 leading-snug">{entry.title}</p>

      {entry.resultSummary && (
        <p className="mt-2 text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
          {entry.resultSummary}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-mono">
        {entry.ledgerStatus === "zombie" && entry.lastHeartbeatAt && (
          <span>last heartbeat {relativeTime(entry.lastHeartbeatAt)}</span>
        )}
        {entry.retryBudget !== null && (
          <span>
            retries {entry.retriesUsed ?? 0}/{entry.retryBudget}
          </span>
        )}
        {entry.verificationVerdict && <span>verification: {entry.verificationVerdict}</span>}
      </div>

      <p className="mt-3 text-[11px] text-amber-300/70 leading-relaxed">
        Pocket Agent stopped here and is waiting on you — nothing more runs on this until you decide.
      </p>
    </div>
  );
}

// ─── Active-right-now card (running sub-agent, PA-MC-4) ─────────────────────────

function ActiveRunCard({ entry }: { entry: RunLedgerEntry }) {
  return (
    <div className="rounded-2xl border border-[#22d3ee]/20 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="flex items-center gap-2 text-[10px] font-mono text-[#22d3ee]/80 uppercase tracking-[0.18em]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22d3ee]/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22d3ee]" />
          </span>
          {entry.slot} · running
        </span>
        <span className="text-[11px] text-slate-600 shrink-0">
          started {relativeTime(entry.startedAt ?? entry.createdAt)}
        </span>
      </div>

      <p className="text-[15px] font-semibold text-slate-100 leading-snug">{entry.title}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-mono">
        {entry.phase && <span className="text-[#22d3ee]/70">phase: {entry.phase}</span>}
        <span>heartbeat {entry.lastHeartbeatAt ? relativeTime(entry.lastHeartbeatAt) : "—"}</span>
        {entry.retryBudget !== null && (
          <span>
            retries {entry.retriesUsed ?? 0}/{entry.retryBudget}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Verifying card (second-opinion gate in flight) ────────────────────────────

function VerifyingRunCard({ entry }: { entry: RunLedgerEntry }) {
  return (
    <div className="rounded-2xl border border-violet-500/20 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] font-mono text-violet-300/80 uppercase tracking-[0.18em]">
          {entry.slot} · verifying
        </span>
        <span className="text-[11px] text-slate-600 shrink-0">{relativeTime(entry.updatedAt)}</span>
      </div>
      <p className="text-[15px] font-semibold text-slate-100 leading-snug">{entry.title}</p>
      <p className="mt-2 text-[11px] text-violet-300/70 leading-relaxed">
        Second-opinion check running before this is marked done.
      </p>
    </div>
  );
}

// ─── Scheduled row (next routine runs with countdown) ──────────────────────────

function ScheduledRow({ entry }: { entry: ScheduledEntry }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-800/50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-slate-200 truncate">{entry.label}</p>
        <p className="text-[11px] text-slate-600 font-mono">{entry.scheduleCron}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-mono text-sky-300/80">{countdownTo(entry.nextRunAt)}</p>
        <p className="text-[10px] text-slate-600">{new Date(entry.nextRunAt).toLocaleString()}</p>
      </div>
    </div>
  );
}

// ─── Draft card (unchanged) ────────────────────────────────────────────────────

function DraftCard({
  card,
  onResolved,
}: {
  card: InboxCard;
  onResolved: (id: string, status: "approved" | "rejected") => void;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [to, setTo] = useState(card.email?.to ?? "");
  const [subject, setSubject] = useState(card.email?.subject ?? "");
  const [body, setBody] = useState(card.email?.body ?? card.bodyMd);

  const isEmail = card.email !== null;

  async function handleApprove() {
    setBusy("approve");
    setErr(null);
    try {
      const init: RequestInit = { method: "POST", cache: "no-store" };
      if (isEmail) {
        init.headers = { "Content-Type": "application/json" };
        init.body = JSON.stringify({ to: to.trim(), subject: subject.trim(), body });
      }
      const res = await fetch(approveEndpoint(card), init);
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Approve failed (${res.status})`);
      }
      onResolved(card.id, "approved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  async function handleReject() {
    setBusy("reject");
    setErr(null);
    try {
      await postDecision(rejectEndpoint(card));
      onResolved(card.id, "rejected");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-[#22d3ee]/15 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] font-mono text-[#22d3ee]/70 uppercase tracking-[0.18em]">
          {card.source}
        </span>
        <span className="text-[11px] text-slate-600 shrink-0">{relativeTime(card.createdAt)}</span>
      </div>

      <p className="text-[15px] font-semibold text-slate-100 leading-snug">{card.title}</p>

      {isEmail && !editing && to.trim() && (
        <p className="text-xs text-slate-500 mt-1 font-mono truncate">To: {to}</p>
      )}

      {editing && isEmail ? (
        <div className="mt-3 space-y-2">
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@email.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none"
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 leading-relaxed focus:border-[#22d3ee] focus:outline-none resize-y font-mono"
          />
        </div>
      ) : (
        <p className="text-sm text-slate-400 mt-2 leading-relaxed whitespace-pre-wrap">
          {card.preview}
        </p>
      )}

      {err && <p className="mt-3 text-xs text-red-400 font-mono">{err}</p>}

      {isEmail && (
        <p className="mt-3 text-[11px] text-slate-600 leading-relaxed">
          Approving sends this reply from your Gmail — threaded into the original conversation and
          saved to your Sent folder.
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleApprove}
          disabled={busy !== null}
          className="flex-1 min-h-[44px] py-3 px-4 rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "approve" ? "Approving…" : isEmail ? "Approve & send" : "Approve"}
        </button>
        {isEmail && (
          <button
            onClick={() => setEditing((v) => !v)}
            disabled={busy !== null}
            className="min-h-[44px] px-4 rounded-xl border border-slate-700/70 text-slate-300 text-sm font-medium hover:border-slate-500 transition-colors disabled:opacity-50"
          >
            {editing ? "Done" : "Edit"}
          </button>
        )}
        <button
          onClick={handleReject}
          disabled={busy !== null}
          aria-label="Reject draft"
          className="min-h-[44px] px-4 rounded-xl text-slate-500 text-sm hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          {busy === "reject" ? "…" : "Reject"}
        </button>
      </div>
    </div>
  );
}

// ─── Email triage card (unchanged) ─────────────────────────────────────────────

function senderLabel(from: string): string {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim();
    return name || match[2].trim();
  }
  return from.trim() || "Unknown sender";
}

async function postTriageAction(threadId: string, action: "handle" | "archive"): Promise<void> {
  const res = await fetch("/api/connections/gmail/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, action }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
}

function addressOf(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

function replySubject(subject: string): string {
  const s = subject.trim();
  if (!s) return "Re:";
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

function buildReplyBrief(triage: TriageDetail): string {
  const sender = senderLabel(triage.from);
  const parts = [
    `Reply to ${sender}${triage.subject ? ` about "${triage.subject}"` : ""}.`,
    triage.snippet ? `Their message: "${triage.snippet}"` : "",
    "Acknowledge, answer their question, and propose a clear next step.",
  ];
  return parts.filter(Boolean).join(" ");
}

function TriageCard({
  card,
  replyDraft,
  onResolved,
  onDraftStaged,
}: {
  card: InboxCard;
  replyDraft: InboxCard | null;
  onResolved: (id: string, status: "approved" | "rejected") => void;
  onDraftStaged: (card: InboxCard) => void;
}) {
  const [busy, setBusy] = useState<"handle" | "archive" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftErr, setDraftErr] = useState<string | null>(null);
  const triage = card.triage;
  if (!triage) return null;

  async function runAction(action: "handle" | "archive") {
    if (busy) return;
    setBusy(action);
    setErr(null);
    try {
      await postTriageAction(triage!.threadId, action);
      onResolved(card.id, "approved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  async function draftReply() {
    if (drafting || replyDraft) return;
    setDrafting(true);
    setDraftErr(null);
    try {
      const genRes = await fetch("/api/app/apps/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "quick", brief: buildReplyBrief(triage!) }),
        cache: "no-store",
      });
      if (!genRes.ok) {
        const b = (await genRes.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(
          b.error === "no_api_key"
            ? "Add your Anthropic API key in Settings to draft replies."
            : b.message ?? b.error ?? `Couldn't draft a reply (${genRes.status})`,
        );
      }
      const gen = (await genRes.json()) as {
        draft: string;
        citations: { file: string; line: string }[];
      };

      const to = addressOf(triage!.from);
      const subject = replySubject(triage!.subject);
      const stageRes = await fetch("/api/app/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          body: gen.draft,
          citations: gen.citations,
          threadId: triage!.threadId,
          inReplyTo: triage!.inReplyTo,
          sourceSurface: "inbox",
        }),
        cache: "no-store",
      });
      if (!stageRes.ok) {
        const b = (await stageRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Couldn't stage the reply (${stageRes.status})`);
      }
      const { item } = (await stageRes.json()) as { item: { id: string; created_at: string } };

      onDraftStaged({
        id: item.id,
        system: "inbox",
        kind: "draft",
        status: "pending",
        title: subject || `Email to ${to}`,
        source: "Email Drafter",
        preview: gen.draft.replace(/\s+/g, " ").trim().slice(0, 180),
        bodyMd: gen.draft,
        createdAt: item.created_at,
        resolvedAt: null,
        email: { to, subject, body: gen.draft },
        triage: null,
        action: null,
        sourceSurface: "inbox",
        threadId: triage!.threadId,
      });
    } catch (e) {
      setDraftErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#22d3ee]/15 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] font-mono text-[#22d3ee]/70 uppercase tracking-[0.18em]">
          Gmail · triage
        </span>
        <span className="text-[11px] text-slate-600 shrink-0">
          {relativeTime(triage.receivedAt ?? card.createdAt)}
        </span>
      </div>

      <a href={triage.url || "#"} target="_blank" rel="noopener noreferrer" className="block group">
        <p className="text-[13px] text-slate-400 truncate">{senderLabel(triage.from)}</p>
        <p className="text-[15px] font-semibold text-slate-100 leading-snug group-hover:text-[#22d3ee] transition-colors">
          {triage.subject || "(no subject)"}
        </p>
        {triage.snippet && (
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
            {triage.snippet}
          </p>
        )}
      </a>

      {err && <p className="mt-3 text-xs text-red-400 font-mono">{err}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => void runAction("handle")}
          disabled={busy !== null}
          className="flex-1 min-h-[44px] py-3 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-slate-200 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "handle" ? "…" : "I'll handle"}
        </button>
        <button
          onClick={() => void draftReply()}
          disabled={busy !== null || drafting || replyDraft !== null}
          className="flex-1 min-h-[44px] py-3 px-3 rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {drafting ? "Drafting…" : replyDraft ? "Reply drafted ↓" : "Draft me a reply"}
        </button>
        <button
          onClick={() => void runAction("archive")}
          disabled={busy !== null}
          aria-label="Archive thread"
          className="min-h-[44px] px-4 rounded-xl text-slate-500 text-sm hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          {busy === "archive" ? "…" : "Archive"}
        </button>
      </div>

      {draftErr && <p className="mt-3 text-xs text-red-400 font-mono">{draftErr}</p>}

      {replyDraft && (
        <div className="mt-4 border-t border-slate-800/60 pt-4">
          <p className="text-[10px] font-mono text-[#22d3ee]/70 uppercase tracking-[0.18em] mb-2">
            Your drafted reply
          </p>
          <DraftCard card={replyDraft} onResolved={onResolved} />
        </div>
      )}
    </div>
  );
}

// ─── Decision card (unchanged) ─────────────────────────────────────────────────

function DecisionCard({
  card,
  onResolved,
}: {
  card: InboxCard;
  onResolved: (id: string, status: "approved" | "rejected") => void;
}) {
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function decide(answer: "yes" | "no") {
    setBusy(answer);
    setErr(null);
    try {
      await postDecision(answer === "yes" ? approveEndpoint(card) : rejectEndpoint(card));
      onResolved(card.id, answer === "yes" ? "approved" : "rejected");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  const hasContext = card.bodyMd.trim().length > 0;

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] font-mono text-amber-400/70 uppercase tracking-[0.18em]">
          {card.source} · needs a decision
        </span>
        <span className="text-[11px] text-slate-600 shrink-0">{relativeTime(card.createdAt)}</span>
      </div>

      <p className="text-[15px] font-semibold text-slate-100 leading-snug">{card.title}</p>

      {hasContext && (
        <>
          <button
            onClick={() => setShowContext((v) => !v)}
            className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showContext ? "Hide context" : "Show context"}
          </button>
          {showContext && (
            <p className="mt-2 text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
              {card.bodyMd}
            </p>
          )}
        </>
      )}

      {err && <p className="mt-3 text-xs text-red-400 font-mono">{err}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => decide("yes")}
          disabled={busy !== null}
          className="flex-1 min-h-[44px] py-3 px-4 rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "yes" ? "…" : "Yes"}
        </button>
        <button
          onClick={() => decide("no")}
          disabled={busy !== null}
          className="flex-1 min-h-[44px] py-3 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "no" ? "…" : "No"}
        </button>
      </div>
    </div>
  );
}

// ─── Action-approval card (unchanged) ──────────────────────────────────────────

function ActionApprovalCard({
  card,
  onResolved,
}: {
  card: InboxCard;
  onResolved: (id: string, status: "approved" | "rejected") => void;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(card.bodyMd);
  const [err, setErr] = useState<string | null>(null);
  const [unlockNote, setUnlockNote] = useState<string | null>(null);

  const connector = card.action?.connector || "connector";
  const action = card.action?.action || "action";

  async function decide(decision: "approve" | "reject") {
    setBusy(decision);
    setErr(null);
    try {
      const res = await fetch(`/api/orchestrator/approvals/${card.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        autoApproveUnlocked?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      if (decision === "approve" && data.autoApproveUnlocked) {
        setUnlockNote(
          `You've approved enough ${connector} · ${action} actions to let Pocket Agent do this on its own. Turn on auto-approve in Settings → Auto-approve.`,
        );
      }
      onResolved(card.id, decision === "approve" ? "approved" : "rejected");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  async function saveEdit() {
    setErr(null);
    try {
      const res = await fetch(`/api/orchestrator/approvals/${card.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "edit", payload: { body } }),
        cache: "no-store",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Edit failed (${res.status})`);
      }
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  if (unlockNote) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-slate-900/60 p-4 sm:p-5">
        <p className="text-sm text-emerald-300/90 leading-relaxed">{unlockNote}</p>
        <Link
          href="/app/settings/auto-approve"
          className="mt-3 inline-block text-xs font-mono text-[#22d3ee]/80 hover:text-[#22d3ee]"
        >
          Manage auto-approve →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] font-mono text-amber-400/80 uppercase tracking-[0.18em]">
          {connector} · {action} · needs approval
        </span>
        <span className="text-[11px] text-slate-600 shrink-0">{relativeTime(card.createdAt)}</span>
      </div>

      <p className="text-[15px] font-semibold text-slate-100 leading-snug">{card.title}</p>

      {editing ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 leading-relaxed focus:border-[#22d3ee] focus:outline-none resize-y font-mono"
        />
      ) : (
        <pre className="mt-3 text-xs text-slate-400 whitespace-pre-wrap font-mono bg-slate-950/40 rounded-md border border-slate-800/60 px-3 py-2">
          {body || card.preview}
        </pre>
      )}

      <p className="mt-3 text-[11px] text-slate-600 leading-relaxed">
        Nothing fires until you approve. Pocket Agent stages every external action here first.
      </p>

      {err && <p className="mt-3 text-xs text-red-400 font-mono">{err}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => void decide("approve")}
          disabled={busy !== null || editing}
          className="flex-1 min-h-[44px] py-3 px-4 rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>
        {editing ? (
          <button
            onClick={() => void saveEdit()}
            className="min-h-[44px] px-4 rounded-xl border border-slate-700/70 text-slate-300 text-sm font-medium hover:border-slate-500 transition-colors"
          >
            Save
          </button>
        ) : (
          <button
            onClick={() => setEditing(true)}
            disabled={busy !== null}
            className="min-h-[44px] px-4 rounded-xl border border-slate-700/70 text-slate-300 text-sm font-medium hover:border-slate-500 transition-colors disabled:opacity-50"
          >
            Edit
          </button>
        )}
        <button
          onClick={() => void decide("reject")}
          disabled={busy !== null}
          aria-label="Reject action"
          className="min-h-[44px] px-4 rounded-xl text-slate-500 text-sm hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          {busy === "reject" ? "…" : "Reject"}
        </button>
      </div>
    </div>
  );
}

// ─── Routine output card (unchanged) ───────────────────────────────────────────

const ROUTINE_PREVIEW_CHARS = 600;

function RoutineOutputCard({
  card,
  onResolved,
}: {
  card: InboxCard;
  onResolved: (id: string, status: "approved" | "rejected") => void;
}) {
  const [busy, setBusy] = useState<"read" | "save" | "dismiss" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const set = affordancesFor("routine_output");
  const full = card.bodyMd.trim() || card.preview;
  const isLong = full.length > ROUTINE_PREVIEW_CHARS;
  const shown = expanded || !isLong ? full : `${full.slice(0, ROUTINE_PREVIEW_CHARS).trimEnd()}…`;
  const canSave = card.system === "inbox";

  async function markRead() {
    setBusy("read");
    setErr(null);
    try {
      await postDecision(approveEndpoint(card));
      onResolved(card.id, "approved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  async function dismiss() {
    setBusy("dismiss");
    setErr(null);
    try {
      await postDecision(rejectEndpoint(card));
      onResolved(card.id, "rejected");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  async function saveToBrain() {
    setBusy("save");
    setErr(null);
    try {
      const res = await fetch(`/api/app/inbox/${card.id}/save-to-brain`, {
        method: "POST",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
      setSavedNote("Saved to your brain.");
      onResolved(card.id, "approved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  const handlers: Record<string, () => void> = {
    mark_read: () => void markRead(),
    save_to_brain: () => void saveToBrain(),
    dismiss: () => void dismiss(),
  };

  const primary = set.affordances.find((a) => a.role === "primary");
  const secondary = set.affordances.filter(
    (a) => a.role === "secondary" && (a.key !== "save_to_brain" || canSave),
  );
  const destructive = set.affordances.find((a) => a.role === "destructive");

  if (savedNote) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-slate-900/60 p-4 sm:p-5">
        <p className="text-sm text-emerald-300/90 leading-relaxed">{savedNote}</p>
        <Link
          href="/app/documents"
          className="mt-3 inline-block text-xs font-mono text-[#22d3ee]/80 hover:text-[#22d3ee]"
        >
          View in your brain →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] font-mono text-slate-400/80 uppercase tracking-[0.18em]">
          {card.source} · brief
        </span>
        <span className="text-[11px] text-slate-600 shrink-0">{relativeTime(card.createdAt)}</span>
      </div>

      <p className="text-[15px] font-semibold text-slate-100 leading-snug">{card.title}</p>

      <div className="mt-3 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{shown}</div>

      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-mono text-[#22d3ee]/80 hover:text-[#22d3ee] transition-colors"
        >
          {expanded ? "Show less ↑" : "Read full ↓"}
        </button>
      )}

      {err && <p className="mt-3 text-xs text-red-400 font-mono">{err}</p>}

      <div className="mt-4 flex items-center gap-2">
        {primary && (
          <button
            onClick={handlers[primary.key]}
            disabled={busy !== null}
            className="flex-1 min-h-[44px] py-3 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-slate-200 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === "read" ? "…" : primary.label}
          </button>
        )}
        {secondary.map((a) => (
          <button
            key={a.key}
            onClick={handlers[a.key]}
            disabled={busy !== null}
            className="min-h-[44px] px-4 rounded-xl border border-slate-700/70 text-slate-300 text-sm font-medium hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === "save" && a.key === "save_to_brain" ? "Saving…" : a.label}
          </button>
        ))}
        {destructive && (
          <button
            onClick={handlers[destructive.key]}
            disabled={busy !== null}
            aria-label="Dismiss brief"
            className="min-h-[44px] px-4 rounded-xl text-slate-500 text-sm hover:text-slate-300 transition-colors disabled:opacity-50"
          >
            {busy === "dismiss" ? "…" : destructive.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Sub-agent activity card (unchanged) ───────────────────────────────────────

function SubAgentActivityCard({
  card,
  onResolved,
}: {
  card: InboxCard;
  onResolved: (id: string, status: "approved" | "rejected") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = affordancesFor("sub_agent_activity");
  const dismissLabel = set.affordances.find((a) => a.key === "dismiss")?.label ?? "Dismiss";

  async function dismiss() {
    setBusy(true);
    setErr(null);
    try {
      await postDecision(rejectEndpoint(card));
      onResolved(card.id, "rejected");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] font-mono text-violet-300/70 uppercase tracking-[0.18em]">
          Sub-agent · in progress
        </span>
        <span className="text-[11px] text-slate-600 shrink-0">{relativeTime(card.createdAt)}</span>
      </div>

      <p className="text-[15px] font-semibold text-slate-100 leading-snug">{card.title}</p>
      {card.preview && (
        <p className="mt-2 text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
          {card.preview}
        </p>
      )}

      {err && <p className="mt-3 text-xs text-red-400 font-mono">{err}</p>}

      <div className="mt-4 flex items-center justify-end">
        <button
          onClick={() => void dismiss()}
          disabled={busy}
          className="min-h-[44px] px-4 rounded-xl border border-slate-700/70 text-slate-300 text-sm font-medium hover:border-slate-500 transition-colors disabled:opacity-50"
        >
          {busy ? "…" : dismissLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Resolved row (unchanged) ──────────────────────────────────────────────────

function ResolvedRow({ card }: { card: InboxCard }) {
  const label: Record<InboxCard["status"], string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    expired: "Expired",
    failed: "Failed",
  };
  const tone: Record<InboxCard["status"], string> = {
    pending: "text-amber-400",
    approved: "text-emerald-400/80",
    rejected: "text-slate-500",
    expired: "text-slate-500",
    failed: "text-red-400/80",
  };
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-800/50 last:border-0">
      <span className="text-sm text-slate-400 truncate">{card.title}</span>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-[11px] font-mono uppercase tracking-wider ${tone[card.status]}`}>
          {label[card.status]}
        </span>
        <span className="text-[11px] text-slate-600">
          {relativeTime(card.resolvedAt ?? card.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count, tone }: { label: string; count: number; tone?: string }) {
  return (
    <div className={`text-[11px] font-mono uppercase tracking-wider mb-3 ${tone ?? "text-slate-600"}`}>
      {label} · {count}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const EMPTY_COUNTS: MissionControlSnapshot["counts"] = {
  attention: 0,
  active: 0,
  verifying: 0,
  scheduled: 0,
  done: 0,
  idle: 0,
};

export default function MissionControlClient({ brainRepo: _brainRepo }: { brainRepo: string | null }) {
  const [cards, setCards] = useState<InboxCard[]>([]);
  const [snapshot, setSnapshot] = useState<MissionControlSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  // First load shows the Mascot; subsequent 8s polls refresh in place without a flash.
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const [inboxRes, mcRes] = await Promise.all([
        fetch("/api/app/inbox", { cache: "no-store" }),
        fetch("/api/app/mission-control", { cache: "no-store" }),
      ]);
      if (!inboxRes.ok) throw new Error(`Failed to load queue (${inboxRes.status})`);
      if (!mcRes.ok) throw new Error(`Failed to load fleet (${mcRes.status})`);
      const inbox = (await inboxRes.json()) as InboxResponse;
      const mc = (await mcRes.json()) as MissionControlResponse;
      setCards(inbox.cards);
      setSnapshot(mc);
      setFetchError(null);
    } catch (e) {
      // On a background poll, keep the last good snapshot and surface the error quietly; only the
      // very first load promotes the error to the full-pane state.
      if (firstLoad.current) setFetchError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (firstLoad.current) {
        setLoading(false);
        firstLoad.current = false;
      }
    }
  }, []);

  // Live updates (PA-MC-2): poll every 8s, but only while the tab is visible. The Page Visibility
  // API pauses the timer on blur and fires an immediate refresh on return, so a backgrounded tab
  // costs nothing and a foregrounded one is never stale.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const start = () => {
      if (timer === null) timer = setInterval(() => void load(), 8000);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load();
        start();
      } else {
        stop();
      }
    };

    void load();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [load]);

  function onResolved(id: string, status: "approved" | "rejected") {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status, resolvedAt: new Date().toISOString() } : c)),
    );
  }

  function onDraftStaged(card: InboxCard) {
    setCards((prev) => [card, ...prev]);
  }

  const counts = snapshot?.counts ?? EMPTY_COUNTS;

  const pending = cards.filter((c) => c.status === "pending");
  const inSection = (s: AwaitingSection) => pending.filter((c) => sectionFor(c.kind) === s);
  const triage = inSection("triage");
  const actions = inSection("actions");
  const decisions = inSection("decisions");
  const briefs = inSection("briefs");
  const activity = inSection("activity");

  const pendingTriageThreadIds = new Set(
    triage.map((c) => c.triage?.threadId).filter((t): t is string => Boolean(t)),
  );
  const inlineReplyByThread = new Map<string, InboxCard>();
  for (const c of cards) {
    if (
      c.kind === "draft" &&
      c.status === "pending" &&
      c.sourceSurface === "inbox" &&
      c.threadId &&
      pendingTriageThreadIds.has(c.threadId)
    ) {
      inlineReplyByThread.set(c.threadId, c);
    }
  }
  const drafts = cards.filter(
    (c) =>
      c.kind === "draft" &&
      c.status === "pending" &&
      !(c.sourceSurface === "inbox" && c.threadId && pendingTriageThreadIds.has(c.threadId)),
  );
  const resolved = cards.filter((c) => c.status !== "pending").slice(0, 20);

  const attention = snapshot?.attention ?? [];
  const active = snapshot?.active ?? [];
  const verifying = snapshot?.verifying ?? [];
  const scheduled = snapshot?.scheduled ?? [];
  const recentlyDone = snapshot?.recentlyDone ?? [];

  const awaitingCount =
    triage.length + actions.length + drafts.length + decisions.length + briefs.length + activity.length;
  const allClear =
    attention.length === 0 &&
    active.length === 0 &&
    verifying.length === 0 &&
    awaitingCount === 0;

  return (
    <div className="h-full overflow-y-auto bg-[#05070a]">
      <div
        className="max-w-2xl mx-auto px-5 sm:px-6 py-8 sm:py-10"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2.5rem)" }}
      >
        <div className="mb-2">
          <Link
            href="/app/apps"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Work apps
          </Link>
        </div>

        <div className="mb-7">
          <div className="text-[10px] text-[#22d3ee]/60 font-mono tracking-[0.2em] uppercase mb-2">
            Agent desk · Live
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Mission Control</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            One live view of your whole agent fleet — what needs you, what&apos;s running right now,
            what&apos;s scheduled, and what just finished. It refreshes itself every few seconds.
            Nothing sends or saves without your explicit go-ahead.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-10 flex flex-col items-center gap-3">
            <Mascot state="working" size={80} />
            <p className="text-[12px] font-mono text-slate-500">syncing your fleet…</p>
          </div>
        ) : fetchError ? (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-6 py-6">
            <p className="text-red-400 text-sm font-mono">{fetchError}</p>
          </div>
        ) : (
          <>
            <StatStrip counts={counts} />

            {/* 1 · Attention — failed / lost-contact / parked sub-agents */}
            {attention.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Attention" count={attention.length} tone="text-amber-400/80" />
                <div className="flex flex-col gap-3">
                  {attention.map((entry) => (
                    <AttentionRunCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </section>
            )}

            {/* 2 · Active right now — running sub-agents with heartbeat + retry budget */}
            {active.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Active right now" count={active.length} tone="text-[#22d3ee]/70" />
                <div className="flex flex-col gap-3">
                  {active.map((entry) => (
                    <ActiveRunCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </section>
            )}

            {/* 3 · Verifying — second-opinion gate in flight */}
            {verifying.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Verifying" count={verifying.length} tone="text-violet-300/70" />
                <div className="flex flex-col gap-3">
                  {verifying.map((entry) => (
                    <VerifyingRunCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </section>
            )}

            {/* 4 · Awaiting your decision — the original kind-grouped approval queue */}
            {triage.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Email to triage" count={triage.length} />
                <div className="flex flex-col gap-3">
                  {triage.map((card) => (
                    <TriageCard
                      key={card.id}
                      card={card}
                      replyDraft={
                        card.triage ? inlineReplyByThread.get(card.triage.threadId) ?? null : null
                      }
                      onResolved={onResolved}
                      onDraftStaged={onDraftStaged}
                    />
                  ))}
                </div>
              </section>
            )}

            {actions.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Actions awaiting approval" count={actions.length} />
                <div className="flex flex-col gap-3">
                  {actions.map((card) => (
                    <ActionApprovalCard key={card.id} card={card} onResolved={onResolved} />
                  ))}
                </div>
              </section>
            )}

            {drafts.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Drafts awaiting approval" count={drafts.length} />
                <div className="flex flex-col gap-3">
                  {drafts.map((card) => (
                    <DraftCard key={card.id} card={card} onResolved={onResolved} />
                  ))}
                </div>
              </section>
            )}

            {decisions.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Quick decisions" count={decisions.length} />
                <div className="flex flex-col gap-3">
                  {decisions.map((card) => (
                    <DecisionCard key={card.id} card={card} onResolved={onResolved} />
                  ))}
                </div>
              </section>
            )}

            {briefs.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Briefs to read" count={briefs.length} />
                <div className="flex flex-col gap-3">
                  {briefs.map((card) => (
                    <RoutineOutputCard key={card.id} card={card} onResolved={onResolved} />
                  ))}
                </div>
              </section>
            )}

            {activity.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Sub-agent activity" count={activity.length} />
                <div className="flex flex-col gap-3">
                  {activity.map((card) => (
                    <SubAgentActivityCard key={card.id} card={card} onResolved={onResolved} />
                  ))}
                </div>
              </section>
            )}

            {/* 5 · Scheduled — next routine runs with countdown */}
            {scheduled.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Scheduled" count={scheduled.length} tone="text-sky-300/70" />
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-5">
                  {scheduled.map((entry) => (
                    <ScheduledRow key={entry.kind} entry={entry} />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {allClear && (
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-10 flex flex-col items-center gap-4">
                <Mascot state="inbox" size={104} />
                <div className="text-center max-w-sm">
                  <div className="text-slate-100 text-base font-semibold mb-2">Fleet&apos;s all clear</div>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Nothing needs you and nothing&apos;s mid-flight. The moment a sub-agent kicks off,
                    a draft is staged, or a routine has something for you, it shows up here — live.
                  </p>
                </div>
                <Link
                  href="/app/apps/email"
                  className="text-xs font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors"
                >
                  Draft an email →
                </Link>
              </div>
            )}

            {/* 6 · Done — recently resolved (collapsed) */}
            {(recentlyDone.length > 0 || resolved.length > 0) && (
              <section className="mt-2">
                <button
                  onClick={() => setShowResolved((v) => !v)}
                  className="text-[11px] font-mono text-slate-600 hover:text-slate-400 uppercase tracking-wider transition-colors"
                >
                  Recently resolved · {recentlyDone.length + resolved.length}{" "}
                  {showResolved ? "▲" : "▼"}
                </button>
                {showResolved && (
                  <div className="mt-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 px-5">
                    {recentlyDone.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 py-3 border-b border-slate-800/50 last:border-0"
                      >
                        <span className="text-sm text-slate-400 truncate">{entry.title}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400/80">
                            Done
                          </span>
                          <span className="text-[11px] text-slate-600">
                            {relativeTime(entry.updatedAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {resolved.map((card) => (
                      <ResolvedRow key={`${card.system}-${card.id}`} card={card} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {/* Honest seam — what's live vs. what arrives with Connections */}
        <div className="mt-8 rounded-2xl border border-slate-800/40 px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-400">Live email triage + send</p>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                <Link
                  href="/app/settings/connections"
                  className="text-slate-400 underline hover:text-[#22d3ee]"
                >
                  Connect Gmail
                </Link>{" "}
                and incoming mail lands here every few minutes — handle, reply, or archive in one
                tap. Approving a drafted reply sends it from your Gmail, threaded into the original
                conversation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
