"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Mascot from "@/components/Mascot";
import { affordancesFor, type InboxItemKind } from "@/lib/inbox-affordances";

type TriageDetail = {
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  url: string;
  receivedAt: string | null;
};

type ActionApprovalDetail = {
  connector: string;
  action: string;
  subAgentRunId: string | null;
};

// Mirrors the normalized card from GET /api/app/inbox. Kind union is kept in lockstep
// with InboxItemKind (the affordance source of truth) so the render switch stays exhaustive.
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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

// Which queue section a kind renders in. Exhaustive with a `never` guard: a new
// InboxItemKind must be slotted into a section here (and given affordances in
// inbox-affordances.ts) or the build fails — no kind can silently fall through to
// the wrong card and inherit the wrong buttons.
type InboxSection =
  | "triage"
  | "actions"
  | "drafts"
  | "decisions"
  | "briefs"
  | "activity"
  | "hidden";

function sectionFor(kind: InboxItemKind): InboxSection {
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
    // Persona leads live on the Personas surface, not the approval queue.
    case "persona_lead":
      return "hidden";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

// ─── Draft card ───────────────────────────────────────────────────────────────

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

  // Local, editable copy of the email so the user can tweak before sending.
  const [to, setTo] = useState(card.email?.to ?? "");
  const [subject, setSubject] = useState(card.email?.subject ?? "");
  const [body, setBody] = useState(card.email?.body ?? card.bodyMd);

  const isEmail = card.email !== null;

  async function handleApprove() {
    setBusy("approve");
    setErr(null);
    try {
      // For email drafts, send the (possibly edited) recipient / subject / body so
      // the server sends the final version live via the Gmail connector — AS the user,
      // threaded into the original conversation, no external mail-app hand-off.
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

// ─── Email triage card ────────────────────────────────────────────────────────

// Gmail's From header is `"Name" <addr@host>` or a bare address. Show the name
// when present, else the address.
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

// Pull the bare address out of a Gmail From header (`"Name" <addr>` or `addr`).
function addressOf(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

function replySubject(subject: string): string {
  const s = subject.trim();
  if (!s) return "Re:";
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

// The brief handed to the Email Drafter for an in-Inbox reply — mirrors what the
// old /app/capture/draft hop built server-side, now built right where the user is.
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
  // A reply drafted from within the Inbox for this thread, rendered inline below
  // (source_surface='inbox'). Null until the user taps "Draft me a reply".
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

  // Draft the reply right here in the Inbox: generate with the Email Drafter, then
  // stage it tagged source_surface='inbox' so it renders inline on this thread
  // (never buried in the generic drafts list). No navigation, no scroll-hunting.
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

      {/* Tappable header opens the thread in Gmail */}
      <a
        href={triage.url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
      >
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

      {/* The reply drafted from here approves inline — never re-staged to the bottom of the Inbox. */}
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

// ─── Decision card ────────────────────────────────────────────────────────────

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

// ─── Action-approval card (PA v5 Wave B orchestrator) ──────────────────────────

// One-tap Approve / Reject / Edit for a connector write-action a sub-agent staged. Approving
// fires the runtime's blocked tool call (server-side) and, once an action type clears the
// trust window, surfaces the auto-approve unlock nudge.
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

// ─── Routine output card (Daily Brief / Weekly Digest / Follow-up Sweep) ───────

// An informational routine result. NOT an action — nothing fired and nothing will,
// so there is no Approve and no Reject. The brief content previews inline (a "Read
// full ↓" expander reveals the rest right in the card) so the user can read it, keep
// it, and move on without opening a separate page. Buttons come from the affordance
// source of truth (Mark as read / Save to brain / Dismiss).
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
  // Save-to-brain commits to the brain repo, which only the new pa_inbox_items rows
  // carry the linkage for. Legacy rows can still be read + dismissed.
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

      {/* The brief reads inline — no separate page, no scroll-then-approve dance. */}
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

// ─── Sub-agent activity card (PA v5 Wave B progress) ───────────────────────────

// A dismissible progress card for a running sub-agent. Informational — there is
// nothing to approve, only to clear once read.
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

// ─── Resolved row ─────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InboxClient({ brainRepo }: { brainRepo: string | null }) {
  const [cards, setCards] = useState<InboxCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/app/inbox", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load inbox (${res.status})`);
      const data = (await res.json()) as InboxResponse;
      setCards(data.cards);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function onResolved(id: string, status: "approved" | "rejected") {
    setCards((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status, resolvedAt: new Date().toISOString() } : c,
      ),
    );
  }

  // A reply just drafted from within the Inbox: drop it in so its TriageCard
  // renders it inline immediately, no refetch and no scroll.
  function onDraftStaged(card: InboxCard) {
    setCards((prev) => [card, ...prev]);
  }

  const pending = cards.filter((c) => c.status === "pending");
  const inSection = (s: InboxSection) => pending.filter((c) => sectionFor(c.kind) === s);
  const triage = inSection("triage");
  const actions = inSection("actions");
  const decisions = inSection("decisions");
  const briefs = inSection("briefs");
  const activity = inSection("activity");

  // Replies drafted from within the Inbox (source_surface='inbox') render inline on
  // their originating triage thread instead of in the generic drafts list. Map them
  // by thread for the still-pending triage cards; anything orphaned (its thread was
  // already resolved) falls back to the generic drafts list so it never vanishes.
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
  const resolved = cards
    .filter((c) => c.status !== "pending")
    .slice(0, 20);
  const allClear =
    triage.length === 0 &&
    actions.length === 0 &&
    drafts.length === 0 &&
    decisions.length === 0 &&
    briefs.length === 0 &&
    activity.length === 0;

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
            Agent desk · Approval queue
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Inbox</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Everything your agent stages for you — drafts waiting on your approval and quick
            yes/no decisions. Nothing sends or saves without your explicit go-ahead.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-10 flex flex-col items-center gap-3">
            <Mascot state="working" size={80} />
            <p className="text-[12px] font-mono text-slate-500">checking your desk…</p>
          </div>
        ) : fetchError ? (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-6 py-6">
            <p className="text-red-400 text-sm font-mono">{fetchError}</p>
          </div>
        ) : (
          <>
            {/* Incoming email to triage */}
            {triage.length > 0 && (
              <section className="mb-8">
                <div className="text-[11px] font-mono text-slate-600 uppercase tracking-wider mb-3">
                  Email to triage · {triage.length}
                </div>
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

            {/* Connector actions awaiting approval (orchestrator) */}
            {actions.length > 0 && (
              <section className="mb-8">
                <div className="text-[11px] font-mono text-slate-600 uppercase tracking-wider mb-3">
                  Actions awaiting approval · {actions.length}
                </div>
                <div className="flex flex-col gap-3">
                  {actions.map((card) => (
                    <ActionApprovalCard key={card.id} card={card} onResolved={onResolved} />
                  ))}
                </div>
              </section>
            )}

            {/* Drafts awaiting approval */}
            {drafts.length > 0 && (
              <section className="mb-8">
                <div className="text-[11px] font-mono text-slate-600 uppercase tracking-wider mb-3">
                  Drafts awaiting approval · {drafts.length}
                </div>
                <div className="flex flex-col gap-3">
                  {drafts.map((card) => (
                    <DraftCard key={card.id} card={card} onResolved={onResolved} />
                  ))}
                </div>
              </section>
            )}

            {/* Quick decisions */}
            {decisions.length > 0 && (
              <section className="mb-8">
                <div className="text-[11px] font-mono text-slate-600 uppercase tracking-wider mb-3">
                  Quick decisions · {decisions.length}
                </div>
                <div className="flex flex-col gap-3">
                  {decisions.map((card) => (
                    <DecisionCard key={card.id} card={card} onResolved={onResolved} />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {allClear && (
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-10 flex flex-col items-center gap-4">
                <Mascot state="inbox" size={104} />
                <div className="text-center max-w-sm">
                  <div className="text-slate-100 text-base font-semibold mb-2">All caught up</div>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    New drafts and decisions show up here the moment your agent stages them — a
                    drafted email from the Email Drafter, a recommended brain update, or a quick
                    yes/no it needs from you.
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

            {/* Recently resolved */}
            {resolved.length > 0 && (
              <section className="mt-2">
                <button
                  onClick={() => setShowResolved((v) => !v)}
                  className="text-[11px] font-mono text-slate-600 hover:text-slate-400 uppercase tracking-wider transition-colors"
                >
                  Recently resolved · {resolved.length} {showResolved ? "▲" : "▼"}
                </button>
                {showResolved && (
                  <div className="mt-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 px-5">
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
