"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import Mascot from "@/components/Mascot";
import CostTab from "./CostTab";
import { affordancesFor, type InboxItemKind } from "@/lib/inbox-affordances";
import type {
  LedgerStatus,
  MissionControlCounts,
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

type GateFindingDetail = {
  rule_violated: string;
  rule_source: string;
  plan_task_violating: string;
  severity: "low" | "medium" | "high" | "critical";
  suggested_fix: string;
  evidence: string;
} | null;

type GateCardGate = {
  name: string;
  label: string;
  status: "pass" | "flag" | "hard_fail" | "error";
  finding: GateFindingDetail;
  overridable: boolean;
};

type GateFindingsDetail = {
  projectId: string;
  planVersion: number;
  projectTitle: string;
  verdict: "flagged" | "blocked";
  gates: GateCardGate[];
};

type LeadScoutBatchDetail = {
  runId: string;
  sourceName: string;
  projectId: string | null;
  leadCount: number;
  breakdown: { hot: number; warm: number; cold: number; wrong_fit: number; needs_research: number };
  csvPath: string;
  runPath: string;
  sweepKind: "google_maps" | null;
  category: string;
  location: string;
  noWebsiteCount: number;
};

type SkillProposalDetail = {
  action: "new" | "update";
  slug: string;
  name: string;
  proposedBody: string;
  proposedDescription: string;
  currentVersion: number;
  reason: string;
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
  leadScout: LeadScoutBatchDetail | null;
  skillProposal: SkillProposalDetail | null;
  gate: GateFindingsDetail | null;
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
  if (card.kind === "skill_evolution_proposal") return `/api/app/skills/proposals/${card.id}/approve`;
  return card.system === "legacy"
    ? `/api/app/actions/${card.id}/approve`
    : `/api/app/inbox/${card.id}/approve`;
}

function rejectEndpoint(card: InboxCard): string {
  if (card.kind === "skill_evolution_proposal") return `/api/app/skills/proposals/${card.id}/reject`;
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
type AwaitingSection =
  | "triage"
  | "actions"
  | "gates"
  | "drafts"
  | "decisions"
  | "briefs"
  | "activity"
  | "leads"
  | "budget"
  | "skills"
  | "hidden";

function sectionFor(kind: InboxItemKind): AwaitingSection {
  switch (kind) {
    case "email_triage":
      return "triage";
    case "action_approval":
    case "build_action_approval":
      return "actions";
    case "gate_findings":
      return "gates";
    case "draft":
      return "drafts";
    case "decision":
      return "decisions";
    case "routine_output":
      return "briefs";
    case "sub_agent_activity":
      return "activity";
    case "lead_scout_batch":
      return "leads";
    case "cost_budget_gate":
      return "budget";
    case "skill_evolution_proposal":
      return "skills";
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

// ─── Stat tile strip (PA-MC-10 — tiles are jump buttons) ────────────────────────
//
// Each tile is a real button that scrolls to its urgency section, highlights when that section is
// in view (IntersectionObserver, wired in the page), dims when its count is 0, and toasts instead
// of scrolling when there's no section to jump to. The six tile keys are exactly the six count
// buckets, so a non-zero tile always has a section below — see SECTION_ID / the page's anchors.

type TileKey = keyof MissionControlCounts;

// Anchor id for each tile's section. The page renders a matching `id` on every section so a tap on
// the tile lands on it via scrollIntoView. Idle is a real section now (free sub-agent capacity), so
// it has an anchor too — it used to be a count-only tile with nowhere to go.
const SECTION_ID: Record<TileKey, string> = {
  attention: "mc-attention",
  active: "mc-active",
  verifying: "mc-verifying",
  scheduled: "mc-scheduled",
  done: "mc-done",
  idle: "mc-idle",
};

// Spoken section name for the jump aria-label (the tile's short label is too terse on its own).
const SECTION_LABEL: Record<TileKey, string> = {
  attention: "Attention",
  active: "Active right now",
  verifying: "Verifying",
  scheduled: "Scheduled",
  done: "Recently resolved",
  idle: "Idle capacity",
};

const TILE_ORDER: TileKey[] = ["attention", "active", "verifying", "scheduled", "done", "idle"];

type TileTone = "amber" | "cyan" | "violet" | "blue" | "emerald" | "muted";

const TILE_TONE: Record<TileTone, { value: string; label: string; ring: string; active: string }> = {
  amber: {
    value: "text-amber-300",
    label: "text-amber-400/70",
    ring: "border-amber-500/30",
    active: "border-amber-400 ring-1 ring-amber-400/40",
  },
  cyan: {
    value: "text-[#22d3ee]",
    label: "text-[#22d3ee]/60",
    ring: "border-[#22d3ee]/25",
    active: "border-[#22d3ee] ring-1 ring-[#22d3ee]/40",
  },
  violet: {
    value: "text-violet-300",
    label: "text-violet-300/60",
    ring: "border-violet-500/25",
    active: "border-violet-400 ring-1 ring-violet-400/40",
  },
  blue: {
    value: "text-sky-300",
    label: "text-sky-300/60",
    ring: "border-sky-500/25",
    active: "border-sky-400 ring-1 ring-sky-400/40",
  },
  emerald: {
    value: "text-emerald-300",
    label: "text-emerald-400/60",
    ring: "border-emerald-500/25",
    active: "border-emerald-400 ring-1 ring-emerald-400/40",
  },
  muted: {
    value: "text-slate-300",
    label: "text-slate-500",
    ring: "border-slate-700/50",
    active: "border-slate-500 ring-1 ring-slate-500/40",
  },
};

function StatTile({
  tileKey,
  count,
  label,
  tone,
  active,
  onActivate,
  onArrow,
}: {
  tileKey: TileKey;
  count: number;
  label: string;
  tone: TileTone;
  active: boolean;
  onActivate: (key: TileKey, empty: boolean) => void;
  onArrow: (e: ReactKeyboardEvent<HTMLButtonElement>) => void;
}) {
  const shown = useCountUp(count);
  const t = TILE_TONE[tone];
  const empty = count === 0;
  const ariaLabel = empty
    ? `${SECTION_LABEL[tileKey]} — nothing right now`
    : `Jump to ${SECTION_LABEL[tileKey]} — ${count} item${count === 1 ? "" : "s"}`;
  return (
    <button
      type="button"
      data-tile={tileKey}
      onClick={() => onActivate(tileKey, empty)}
      onKeyDown={onArrow}
      aria-label={ariaLabel}
      title={empty ? "All clear" : undefined}
      className={[
        "group rounded-xl border bg-slate-900/50 px-2.5 py-3 text-center min-h-[44px] cursor-pointer",
        "transition-[transform,colors,border-color] duration-150",
        "motion-safe:hover:scale-[1.04] active:scale-95",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070a]",
        empty ? "opacity-40" : "hover:bg-slate-900/80",
        active && !empty ? t.active : t.ring,
      ].join(" ")}
    >
      <div className={`text-xl sm:text-2xl font-bold tabular-nums ${t.value}`}>{shown}</div>
      <div className={`mt-0.5 text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.12em] ${t.label}`}>
        {label}
      </div>
    </button>
  );
}

function StatStrip({
  counts,
  activeKey,
  onActivate,
  onArrow,
}: {
  counts: MissionControlCounts;
  activeKey: TileKey | null;
  onActivate: (key: TileKey, empty: boolean) => void;
  onArrow: (e: ReactKeyboardEvent<HTMLButtonElement>) => void;
}) {
  const tiles: { key: TileKey; label: string; tone: TileTone }[] = [
    { key: "attention", label: "Attention", tone: "amber" },
    { key: "active", label: "Active", tone: "cyan" },
    { key: "verifying", label: "Verifying", tone: "violet" },
    { key: "scheduled", label: "Scheduled", tone: "blue" },
    { key: "done", label: "Done", tone: "emerald" },
    { key: "idle", label: "Idle", tone: "muted" },
  ];
  return (
    <div
      role="group"
      aria-label="Fleet status — tap a tile to jump to its section"
      className="grid grid-cols-3 sm:grid-cols-6 gap-2"
    >
      {tiles.map((tile) => (
        <StatTile
          key={tile.key}
          tileKey={tile.key}
          count={counts[tile.key]}
          label={tile.label}
          tone={tile.tone}
          active={activeKey === tile.key}
          onActivate={onActivate}
          onArrow={onArrow}
        />
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
        leadScout: null,
        skillProposal: null,
        gate: null,
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

// ─── Gate findings card (PA-GATE-9) ────────────────────────────────────────────
// A held Project plan its specialist gates flagged or blocked. Shows every gate result — passed
// gates too (transparency, Principle 7) — and the flagged ones with the cited rule + where + fix.
// Revise / Reject / Approve-anyway resolve through /api/orchestrator/gates/[id]; Approve-anyway only
// renders when EVERY blocking gate cleared its trust window.

const GATE_STATUS_META: Record<
  GateCardGate["status"],
  { icon: string; chip: string; label: string }
> = {
  pass: { icon: "✅", chip: "border-emerald-500/20 text-emerald-300/90", label: "passed" },
  flag: { icon: "🚩", chip: "border-amber-500/30 text-amber-300/90", label: "flag" },
  hard_fail: { icon: "⛔", chip: "border-red-500/30 text-red-300/90", label: "blocked" },
  error: { icon: "⚠️", chip: "border-red-500/30 text-red-300/90", label: "couldn't run" },
};

function GateFindingsCard({
  card,
  onResolved,
}: {
  card: InboxCard;
  onResolved: (id: string, status: "approved" | "rejected") => void;
}) {
  const [busy, setBusy] = useState<"revise" | "reject" | "approve_anyway" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const gate = card.gate;
  const gates = gate?.gates ?? [];
  const passed = gates.filter((g) => g.status === "pass");
  const blocking = gates.filter((g) => g.status !== "pass");
  // Approve-anyway is offered only when every blocking gate is individually overridable.
  const canApproveAnyway = blocking.length > 0 && blocking.every((g) => g.overridable);
  const blocked = gate?.verdict === "blocked";

  async function decide(decision: "revise" | "reject" | "approve_anyway") {
    setBusy(decision);
    setErr(null);
    try {
      const res = await fetch(`/api/orchestrator/gates/${card.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      onResolved(card.id, decision === "approve_anyway" ? "approved" : "rejected");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <div
      className={`rounded-2xl border ${blocked ? "border-red-500/25" : "border-amber-500/20"} bg-slate-900/60 p-4 sm:p-5`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span
          className={`text-[10px] font-mono uppercase tracking-[0.18em] ${blocked ? "text-red-400/80" : "text-amber-400/80"}`}
        >
          ⚖ Gate Findings · plan v{gate?.planVersion ?? 1} · {blocked ? "blocked" : "waiting on you"}
        </span>
        <span className="text-[11px] text-slate-600 shrink-0">{relativeTime(card.createdAt)}</span>
      </div>

      <p className="text-[15px] font-semibold text-slate-100 leading-snug">{gate?.projectTitle ?? card.title}</p>
      <p className="mt-1 text-[12px] text-slate-500">
        {passed.length} of {gates.length} gates passed.{" "}
        {blocked
          ? `${blocking.length} blocked this plan before it runs.`
          : `${blocking.length} flag${blocking.length === 1 ? "" : "s"} to clear.`}
      </p>

      {passed.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {passed.map((g) => (
            <span
              key={g.name}
              className={`rounded-md border px-2 py-0.5 text-[11px] font-mono ${GATE_STATUS_META.pass.chip}`}
            >
              ✅ {g.label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {blocking.map((g) => {
          const meta = GATE_STATUS_META[g.status];
          return (
            <div key={g.name} className={`rounded-lg border ${meta.chip} bg-slate-950/40 px-3 py-2.5`}>
              <p className="text-[12px] font-semibold">
                {meta.icon} {g.label} — {meta.label}
                {g.finding ? ` (severity: ${g.finding.severity})` : ""}
              </p>
              {g.finding && (
                <div className="mt-1.5 space-y-1 text-[11px] text-slate-400 leading-relaxed">
                  <p>
                    <span className="text-slate-500">Rule:</span> {g.finding.rule_violated}{" "}
                    <span className="text-slate-600">→ {g.finding.rule_source}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">Where:</span> {g.finding.plan_task_violating}
                  </p>
                  <p>
                    <span className="text-slate-500">Found:</span> {g.finding.evidence}
                  </p>
                  <p className="text-slate-300">
                    <span className="text-slate-500">Suggested fix:</span> {g.finding.suggested_fix}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {err && <p className="mt-3 text-xs text-red-400 font-mono">{err}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => void decide("revise")}
          disabled={busy !== null}
          className="flex-1 min-h-[44px] py-3 px-4 rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "revise" ? "Sending back…" : "Revise plan"}
        </button>
        {canApproveAnyway && (
          <button
            onClick={() => void decide("approve_anyway")}
            disabled={busy !== null}
            className="min-h-[44px] px-4 rounded-xl border border-slate-700/70 text-slate-300 text-sm font-medium hover:border-slate-500 transition-colors disabled:opacity-50"
          >
            {busy === "approve_anyway" ? "…" : "Approve anyway"}
          </button>
        )}
        <button
          onClick={() => void decide("reject")}
          disabled={busy !== null}
          aria-label="Reject plan"
          className="min-h-[44px] px-4 rounded-xl text-slate-500 text-sm hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          {busy === "reject" ? "…" : "Reject"}
        </button>
      </div>
      {!canApproveAnyway && blocking.length > 0 && (
        <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">
          Approve-anyway unlocks per gate after a streak of clean passes. For now, revise the plan or reject it.
        </p>
      )}
    </div>
  );
}

// ─── Routine output card (unchanged) ───────────────────────────────────────────

const ROUTINE_PREVIEW_CHARS = 600;

// A Skill the LEARN phase wants to save or sharpen (PA-SKILL-3). The full proposed technique is
// shown right here — a poisoned line would be human-readable — so the owner reads what they're
// approving before it's written to the brain. Approve writes a versioned SKILL.md; deeper edits
// happen on the Skills tab.
function SkillProposalCard({
  card,
  onResolved,
}: {
  card: InboxCard;
  onResolved: (id: string, status: "approved" | "rejected") => void;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const p = card.skillProposal;
  const isUpdate = p?.action === "update";
  const body = (p?.proposedBody ?? card.bodyMd).trim();
  const isLong = body.length > 600;
  const shown = expanded || !isLong ? body : `${body.slice(0, 600).trimEnd()}…`;

  async function decide(kind: "approve" | "reject") {
    setBusy(kind);
    setErr(null);
    try {
      await postDecision(kind === "approve" ? approveEndpoint(card) : rejectEndpoint(card));
      onResolved(card.id, kind === "approve" ? "approved" : "rejected");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] font-mono text-violet-300/80 uppercase tracking-[0.18em]">
          {isUpdate ? `Sharpen skill · was v${p?.currentVersion ?? 1}` : "New skill"}
        </span>
        <span className="text-[11px] text-slate-600 shrink-0">{relativeTime(card.createdAt)}</span>
      </div>

      <p className="text-[15px] font-semibold text-slate-100 leading-snug">{p?.name || card.title}</p>
      {p?.reason && <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">{p.reason}</p>}
      {p?.proposedDescription && (
        <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">{p.proposedDescription}</p>
      )}

      <div className="mt-3 rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
        {shown}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-mono text-[#22d3ee]/80 hover:text-[#22d3ee] transition-colors"
        >
          {expanded ? "Show less ↑" : "Read the full technique ↓"}
        </button>
      )}

      {err && <p className="mt-3 text-xs text-red-400 font-mono">{err}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => void decide("approve")}
          disabled={busy !== null}
          className="min-h-[44px] rounded-xl bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-4 text-sm font-medium text-[#22d3ee] hover:bg-[#22d3ee]/25 disabled:opacity-50 transition-colors"
        >
          {busy === "approve" ? "Saving…" : isUpdate ? "Approve update" : "Approve & save"}
        </button>
        <Link
          href="/app/skills"
          className="min-h-[44px] flex items-center rounded-xl border border-slate-700/60 px-4 text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
        >
          Review &amp; edit in Skills →
        </Link>
        <button
          onClick={() => void decide("reject")}
          disabled={busy !== null}
          className="min-h-[44px] rounded-xl border border-slate-700/60 px-4 text-sm text-slate-400 hover:border-red-500/50 hover:text-red-300 disabled:opacity-50 transition-colors ml-auto"
        >
          {busy === "reject" ? "…" : "Reject"}
        </button>
      </div>
    </div>
  );
}

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

// ─── Cost budget gate card (PA-COST-14) ────────────────────────────────────────
//
// The dispatcher paused new background agent runs because the owner hit their monthly cost cap. Nothing
// fires on tap (a refused dispatch isn't held in a queue to "release") — raising the cap, which is what
// actually un-gates, happens in Settings → Budget. So this card is honest: "Raise the cap" links there,
// "Wait until next period" clears the card and lets runs resume on their own when the budget resets.

function CostBudgetGateCard({
  card,
  onResolved,
}: {
  card: InboxCard;
  onResolved: (id: string, status: "approved" | "rejected") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function wait() {
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
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] font-mono text-amber-300/70 uppercase tracking-[0.18em]">
          Cost budget
        </span>
        <span className="text-[11px] text-slate-600 shrink-0">{relativeTime(card.createdAt)}</span>
      </div>

      <p className="text-[15px] font-semibold text-slate-100 leading-snug">{card.title}</p>

      <div className="mt-3 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
        {card.bodyMd.trim() || card.preview}
      </div>

      {err && <p className="mt-3 text-xs text-red-400 font-mono">{err}</p>}

      <div className="mt-4 flex items-center gap-2">
        <Link
          href="/app/settings/budget"
          className="flex-1 min-h-[44px] flex items-center justify-center py-3 px-4 rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors"
        >
          Raise the cap
        </Link>
        <button
          onClick={() => void wait()}
          disabled={busy}
          className="min-h-[44px] px-4 rounded-xl border border-slate-700/70 text-slate-300 text-sm font-medium hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "…" : "Wait until next period"}
        </button>
      </div>
    </div>
  );
}

// ─── Lead Scout batch card (PA-LS-7) ───────────────────────────────────────────
//
// A finished scrape batch: classification breakdown, top leads, a CSV download, and a Phase-3 hook
// to draft outreach for the warm+hot leads. Informational (the leads are already saved to the brain
// and the run page) — Mark as read / Dismiss, never Approve.

const LEAD_CHIPS: {
  key: keyof LeadScoutBatchDetail["breakdown"];
  label: string;
  tone: string;
}[] = [
  { key: "hot", label: "hot", tone: "text-amber-300 border-amber-500/30 bg-amber-500/5" },
  { key: "warm", label: "warm", tone: "text-[#22d3ee] border-[#22d3ee]/30 bg-[#22d3ee]/5" },
  { key: "cold", label: "cold", tone: "text-slate-300 border-slate-700/60 bg-slate-800/30" },
  { key: "wrong_fit", label: "wrong-fit", tone: "text-slate-500 border-slate-800/60 bg-transparent" },
  {
    key: "needs_research",
    label: "needs research",
    tone: "text-violet-300/80 border-violet-500/25 bg-violet-500/5",
  },
];

function LeadScoutBatchCard({
  card,
  onResolved,
}: {
  card: InboxCard;
  onResolved: (id: string, status: "approved" | "rejected") => void;
}) {
  const [busy, setBusy] = useState<"read" | "dismiss" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftErr, setDraftErr] = useState<string | null>(null);
  const [draftedCount, setDraftedCount] = useState<number | null>(null);
  const detail = card.leadScout;

  const warmHot = detail ? detail.breakdown.hot + detail.breakdown.warm : 0;

  // Phase 3: stage personalized outreach in the owner's voice for the run's hot + warm leads. Each
  // draft lands in the Drafts section as Approve & Send — sending goes through the owner's Gmail.
  async function generateOutreach() {
    if (drafting || !detail?.runId) return;
    setDrafting(true);
    setDraftErr(null);
    try {
      const res = await fetch(
        `/api/app/apps/lead-scout/runs/${detail.runId}/draft-outreach`,
        { method: "POST", cache: "no-store" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        count?: number;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setDraftErr(body.message ?? body.error ?? `Couldn't draft outreach (${res.status}).`);
        return;
      }
      setDraftedCount(body.count ?? 0);
    } catch (e) {
      setDraftErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setDrafting(false);
    }
  }

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

  // The card body is "<breakdown line>\n\n**Top leads**\n\n<bullets>"; the chips already show the
  // breakdown, so render just the top-leads portion below them.
  const topLeads = card.bodyMd.split("**Top leads**").pop()?.trim() ?? "";

  return (
    <div className="rounded-2xl border border-[#22d3ee]/15 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] font-mono text-[#22d3ee]/70 uppercase tracking-[0.18em]">
          {detail?.sweepKind === "google_maps" ? "Lead Scout · Google Maps" : "Lead Scout"} ·{" "}
          {detail?.sourceName ?? "batch"}
        </span>
        <span className="text-[11px] text-slate-600 shrink-0">{relativeTime(card.createdAt)}</span>
      </div>

      <p className="text-[15px] font-semibold text-slate-100 leading-snug">{card.title}</p>

      {detail?.sweepKind === "google_maps" && (
        <p className="mt-1 text-[13px] text-slate-400 leading-relaxed">
          {detail.noWebsiteCount} of {detail.leadCount} {detail.category || "businesses"} in{" "}
          {detail.location} have no website on their Maps listing — the ones to pitch a site.
        </p>
      )}

      {detail && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {LEAD_CHIPS.map((chip) => (
            <span
              key={chip.key}
              className={`text-[11px] font-mono rounded border px-2 py-0.5 ${chip.tone}`}
            >
              {detail.breakdown[chip.key]} {chip.label}
            </span>
          ))}
        </div>
      )}

      {topLeads && (
        <div className="mt-3 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {topLeads}
        </div>
      )}

      {err && <p className="mt-3 text-xs text-red-400 font-mono">{err}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {detail?.csvPath && (
          <a
            href={detail.csvPath}
            className="min-h-[44px] inline-flex items-center px-4 rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors"
          >
            Download CSV
          </a>
        )}
        {detail?.runId && (
          <Link
            href={`/app/apps/lead-scout/runs/${detail.runId}`}
            className="min-h-[44px] inline-flex items-center px-4 rounded-xl border border-slate-700/70 text-slate-300 text-sm font-medium hover:border-slate-500 transition-colors"
          >
            View all leads →
          </Link>
        )}
        {detail?.projectId && (
          <Link
            href={`/app/projects/${detail.projectId}`}
            className="min-h-[44px] inline-flex items-center px-4 rounded-xl border border-slate-700/70 text-slate-300 text-sm font-medium hover:border-slate-500 transition-colors"
          >
            Open project →
          </Link>
        )}
        {draftedCount === null ? (
          <button
            type="button"
            onClick={() => void generateOutreach()}
            disabled={drafting || warmHot === 0}
            title={
              warmHot === 0
                ? "No hot or warm leads in this batch to draft for."
                : "Draft outreach in your voice for every hot + warm lead."
            }
            className="min-h-[44px] px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#1a1206] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {drafting ? "Drafting…" : `Draft outreach for hot + warm${warmHot ? ` (${warmHot})` : ""}`}
          </button>
        ) : (
          <Link
            href="/app/mission-control"
            className="min-h-[44px] inline-flex items-center px-4 rounded-xl border border-amber-400/40 text-amber-200 text-sm font-medium hover:border-amber-300 transition-colors"
          >
            {draftedCount} outreach {draftedCount === 1 ? "draft" : "drafts"} staged → review them ↓
          </Link>
        )}
      </div>

      {draftErr && <p className="mt-2 text-[11px] text-red-400 font-mono">{draftErr}</p>}

      <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">
        {draftedCount === null
          ? "Drafting writes one email per hot + warm lead in your voice and stages each for your tap. Every lead is also saved to your brain and in the CSV."
          : "Each draft is in your Drafts below — read the first few, then Approve & Send straight from your Gmail."}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => void markRead()}
          disabled={busy !== null}
          className="flex-1 min-h-[44px] py-3 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-slate-200 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "read" ? "…" : "Mark for follow-up later"}
        </button>
        <button
          onClick={() => void dismiss()}
          disabled={busy !== null}
          aria-label="Dismiss lead batch"
          className="min-h-[44px] px-4 rounded-xl text-slate-500 text-sm hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          {busy === "dismiss" ? "…" : "Dismiss"}
        </button>
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

// Email-triage backlog cap (PA-MC-10): show this many inline, collapse the rest behind "Show all".
const TRIAGE_PREVIEW = 5;

const EMPTY_COUNTS: MissionControlSnapshot["counts"] = {
  attention: 0,
  active: 0,
  verifying: 0,
  scheduled: 0,
  done: 0,
  idle: 0,
};

type MissionTab = "operations" | "cost";

export default function MissionControlClient({ brainRepo: _brainRepo }: { brainRepo: string | null }) {
  // Two tabs on one cockpit (PA-COST-1): Operations (the live fleet pane below) + Cost (the read-only
  // spend dashboard). Both auto-refresh on focus; Operations only polls while its tab is active.
  const [tab, setTab] = useState<MissionTab>("operations");
  const [cards, setCards] = useState<InboxCard[]>([]);
  const [snapshot, setSnapshot] = useState<MissionControlSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [showAllTriage, setShowAllTriage] = useState(false);
  // Which tile's section is currently in view (drives the bright accent border). Null until the
  // IntersectionObserver or a tap sets it; the render falls back to a computed default.
  const [activeKey, setActiveKey] = useState<TileKey | null>(null);
  // Brief inline toast shown when an empty (0-count) tile is tapped — there's no section to jump to.
  const [toast, setToast] = useState<string | null>(null);
  // Measured height of the sticky stat strip, so scroll offsets and the IntersectionObserver root
  // discount it (sections land below the pinned strip, not under it).
  const [headerH, setHeaderH] = useState(100);
  // First load shows the Mascot; subsequent 8s polls refresh in place without a flash.
  const firstLoad = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Only the Operations tab polls the fleet; the Cost tab owns its own refresh loop, so we don't
    // burn a request every 8s on a snapshot the user isn't looking at.
    if (tab !== "operations") return;

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
  }, [load, tab]);

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
  const gateCards = inSection("gates");
  const decisions = inSection("decisions");
  const briefs = inSection("briefs");
  const leads = inSection("leads");
  const budgetGates = inSection("budget");
  const activity = inSection("activity");
  const skillProposals = inSection("skills");

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
  const idle = counts.idle;
  const doneSectionPresent = recentlyDone.length > 0 || resolved.length > 0;

  // Which tile sections are actually rendered below — the invariant is that a non-zero tile always
  // has a section here (Idle included, now that it's a real section). Used to scope the
  // IntersectionObserver, validate the active tile, and pick the default highlight.
  const present: Record<TileKey, boolean> = {
    attention: attention.length > 0,
    active: active.length > 0,
    verifying: verifying.length > 0,
    scheduled: scheduled.length > 0,
    done: doneSectionPresent,
    idle: idle > 0,
  };
  const presentSections = TILE_ORDER.filter((k) => present[k]).join(",");
  // Default highlight: Attention if it has items, otherwise the first non-empty section (PA-MC-10).
  const defaultKey = TILE_ORDER.find((k) => present[k]) ?? null;
  const effectiveActive = activeKey && present[activeKey] ? activeKey : defaultKey;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // Tap / Enter / Space on a tile: scroll to its section, or toast if the bucket is empty. Done also
  // expands its collapsed list so the jump lands on something visible.
  const handleTile = useCallback(
    (key: TileKey, empty: boolean) => {
      if (empty) {
        showToast("Nothing here right now");
        return;
      }
      if (key === "done") setShowResolved(true);
      const el = document.getElementById(SECTION_ID[key]);
      if (!el) {
        showToast("Nothing here right now");
        return;
      }
      el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      setActiveKey(key);
    },
    [showToast],
  );

  // Arrow keys move focus between tiles (roving). Enter/Space activate natively via the button.
  const handleTileArrow = useCallback((e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const strip = stripRef.current;
    if (!strip) return;
    const buttons = Array.from(strip.querySelectorAll<HTMLButtonElement>("button[data-tile]"));
    const idx = buttons.indexOf(e.currentTarget);
    if (idx === -1) return;
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const next = (idx + (forward ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }, []);

  // Keep `headerH` in sync with the sticky strip's real height (changes across breakpoints).
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const update = () => setHeaderH(strip.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(strip);
    return () => ro.disconnect();
  }, [loading, fetchError]);

  // Active-tile highlight (PA-MC-10): mark the topmost section currently below the sticky strip. The
  // top rootMargin discounts the strip; the bottom one means a section is "active" once it reaches
  // the upper third of the pane rather than the moment it peeks in.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const observed = TILE_ORDER.map((k) => {
      const el = document.getElementById(SECTION_ID[k]);
      return el ? ([k, el] as const) : null;
    }).filter((x): x is readonly [TileKey, HTMLElement] => x !== null);
    if (observed.length === 0) return;
    const idToKey = new Map(observed.map(([k, el]) => [el.id, k]));
    const visible = new Set<TileKey>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const k = idToKey.get(entry.target.id);
          if (!k) continue;
          if (entry.isIntersecting) visible.add(k);
          else visible.delete(k);
        }
        const topmost = TILE_ORDER.find((k) => visible.has(k));
        if (topmost) setActiveKey(topmost);
      },
      { root: container, rootMargin: `-${headerH + 4}px 0px -55% 0px`, threshold: 0 },
    );
    observed.forEach(([, el]) => observer.observe(el));
    return () => observer.disconnect();
  }, [presentSections, headerH]);

  // Reset the triage "show all" toggle once the backlog drains below the preview cap.
  useEffect(() => {
    if (showAllTriage && triage.length <= TRIAGE_PREVIEW) setShowAllTriage(false);
  }, [showAllTriage, triage.length]);

  const sectionOffset = { scrollMarginTop: headerH + 12 };

  const awaitingCount =
    triage.length +
    actions.length +
    drafts.length +
    decisions.length +
    briefs.length +
    leads.length +
    activity.length;
  const allClear =
    attention.length === 0 &&
    active.length === 0 &&
    verifying.length === 0 &&
    awaitingCount === 0;

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto bg-[#05070a]">
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

        <div className="mb-5">
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

        {/* Operations | Cost (PA-COST-1) — one cockpit, two tabs */}
        <div role="tablist" aria-label="Mission Control views" className="flex items-center gap-1.5 mb-7">
          {(["operations", "cost"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={[
                "min-h-[44px] px-4 rounded-xl text-sm font-medium transition-colors capitalize",
                tab === t
                  ? "bg-slate-800/80 text-slate-100 border border-slate-700"
                  : "border border-transparent text-slate-500 hover:text-slate-300",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "cost" ? (
          <CostTab />
        ) : (
          <>
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
            <div
              ref={stripRef}
              className="sticky top-0 z-20 -mx-5 sm:-mx-6 px-5 sm:px-6 pt-2 pb-3 mb-8 bg-[#05070a]/95 backdrop-blur border-b border-slate-800/40"
            >
              <StatStrip
                counts={counts}
                activeKey={effectiveActive}
                onActivate={handleTile}
                onArrow={handleTileArrow}
              />
            </div>

            {/* 1 · Attention — failed / lost-contact / parked sub-agents */}
            {attention.length > 0 && (
              <section id={SECTION_ID.attention} style={sectionOffset} className="mb-8">
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
              <section id={SECTION_ID.active} style={sectionOffset} className="mb-8">
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
              <section id={SECTION_ID.verifying} style={sectionOffset} className="mb-8">
                <SectionHeader label="Verifying" count={verifying.length} tone="text-violet-300/70" />
                <div className="flex flex-col gap-3">
                  {verifying.map((entry) => (
                    <VerifyingRunCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </section>
            )}

            {/* 4 · Awaiting your decision — the original kind-grouped approval queue. A large email
                backlog is capped to the first few inline and collapsed behind "Show all" (PA-MC-10)
                so it can't bury Scheduled / Idle / Done below it. */}
            {triage.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Email to triage" count={triage.length} />
                <div className="flex flex-col gap-3">
                  {(showAllTriage ? triage : triage.slice(0, TRIAGE_PREVIEW)).map((card) => (
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
                {triage.length > TRIAGE_PREVIEW && (
                  <button
                    onClick={() => setShowAllTriage((v) => !v)}
                    className="mt-3 w-full min-h-[44px] rounded-xl border border-slate-800/70 text-[12px] font-mono text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors"
                  >
                    {showAllTriage
                      ? "Show fewer ↑"
                      : `Show all ${triage.length} emails to triage ↓`}
                  </button>
                )}
              </section>
            )}

            {budgetGates.length > 0 && (
              <section className="mb-8">
                <SectionHeader
                  label="Cost budget reached"
                  count={budgetGates.length}
                  tone="text-amber-300/70"
                />
                <div className="flex flex-col gap-3">
                  {budgetGates.map((card) => (
                    <CostBudgetGateCard key={card.id} card={card} onResolved={onResolved} />
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

            {gateCards.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Plans held at the Gate Phase" count={gateCards.length} />
                <div className="flex flex-col gap-3">
                  {gateCards.map((card) => (
                    <GateFindingsCard key={card.id} card={card} onResolved={onResolved} />
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

            {leads.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Lead batches" count={leads.length} tone="text-[#22d3ee]/70" />
                <div className="flex flex-col gap-3">
                  {leads.map((card) => (
                    <LeadScoutBatchCard key={card.id} card={card} onResolved={onResolved} />
                  ))}
                </div>
              </section>
            )}

            {skillProposals.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Skills to review" count={skillProposals.length} tone="text-violet-300/70" />
                <div className="flex flex-col gap-3">
                  {skillProposals.map((card) => (
                    <SkillProposalCard key={card.id} card={card} onResolved={onResolved} />
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
              <section id={SECTION_ID.scheduled} style={sectionOffset} className="mb-8">
                <SectionHeader label="Scheduled" count={scheduled.length} tone="text-sky-300/70" />
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-5">
                  {scheduled.map((entry) => (
                    <ScheduledRow key={entry.kind} entry={entry} />
                  ))}
                </div>
              </section>
            )}

            {/* 6 · Idle — free sub-agent capacity. This is a real section now: the Idle tile used to
                count free slots with nowhere to jump to, which is what left "Idle · N" pointing at
                nothing. */}
            {idle > 0 && (
              <section id={SECTION_ID.idle} style={sectionOffset} className="mb-8">
                <SectionHeader label="Idle capacity" count={idle} tone="text-slate-500" />
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-5 py-5">
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {idle === 1 ? "One free slot" : `${idle} free slots`} — Pocket Agent has capacity
                    to run {idle === 1 ? "one more task" : `${idle} more tasks`} at the same time
                    right now. Hand it something and it picks it up immediately.
                  </p>
                  <Link
                    href="/app/ask"
                    className="mt-3 inline-block text-xs font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors"
                  >
                    Give it a task →
                  </Link>
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

            {/* 7 · Done — recently resolved (collapsed) */}
            {(recentlyDone.length > 0 || resolved.length > 0) && (
              <section id={SECTION_ID.done} style={sectionOffset} className="mt-2">
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
          </>
        )}
      </div>

      {/* Tap-an-empty-tile toast (PA-MC-10) — there's no section to scroll to, so we say so. */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
        >
          <div className="rounded-full border border-slate-700/70 bg-slate-900/95 px-4 py-2 text-xs font-mono text-slate-300 shadow-lg backdrop-blur">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
