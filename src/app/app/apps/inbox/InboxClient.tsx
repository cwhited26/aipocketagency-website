"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Mascot from "@/components/Mascot";

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

// Mirrors the normalized card from GET /api/app/inbox.
type InboxCard = {
  id: string;
  system: "inbox" | "legacy";
  kind: "draft" | "decision" | "email_triage" | "persona_lead" | "action_approval";
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
      const res = await fetch(approveEndpoint(card), { method: "POST", cache: "no-store" });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Approve failed (${res.status})`);
      }
      if (isEmail) {
        // Hand the send back to the user: copy the (possibly edited) body and
        // open their mail client pre-filled. Live Gmail send arrives with Connections.
        await navigator.clipboard.writeText(body).catch(() => {});
        const query = new URLSearchParams();
        if (subject.trim()) query.set("subject", subject.trim());
        if (body.trim()) query.set("body", body);
        const qs = query.toString();
        window.location.href = `mailto:${encodeURIComponent(to.trim())}${qs ? `?${qs}` : ""}`;
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
          Approving copies the email and opens your mail app to send — it doesn&apos;t send on its
          own.
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

function TriageCard({
  card,
  onResolved,
}: {
  card: InboxCard;
  onResolved: (id: string, status: "approved" | "rejected") => void;
}) {
  const [busy, setBusy] = useState<"handle" | "archive" | null>(null);
  const [err, setErr] = useState<string | null>(null);
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

  const replyHref = `/app/capture/draft?context=email_triage&threadId=${encodeURIComponent(
    triage.threadId,
  )}`;

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
        <Link
          href={replyHref}
          className="flex-1 min-h-[44px] flex items-center justify-center py-3 px-3 rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors text-center"
        >
          Draft me a reply
        </Link>
        <button
          onClick={() => void runAction("archive")}
          disabled={busy !== null}
          aria-label="Archive thread"
          className="min-h-[44px] px-4 rounded-xl text-slate-500 text-sm hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          {busy === "archive" ? "…" : "Archive"}
        </button>
      </div>
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

  const triage = cards.filter((c) => c.kind === "email_triage" && c.status === "pending");
  const actions = cards.filter((c) => c.kind === "action_approval" && c.status === "pending");
  const drafts = cards.filter((c) => c.kind === "draft" && c.status === "pending");
  const decisions = cards.filter((c) => c.kind === "decision" && c.status === "pending");
  const resolved = cards
    .filter((c) => c.status !== "pending")
    .slice(0, 20);
  const allClear =
    triage.length === 0 &&
    actions.length === 0 &&
    drafts.length === 0 &&
    decisions.length === 0;

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
                    <TriageCard key={card.id} card={card} onResolved={onResolved} />
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
              <p className="text-sm font-medium text-slate-400">Live email triage</p>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                <Link
                  href="/app/settings/connections"
                  className="text-slate-400 underline hover:text-[#22d3ee]"
                >
                  Connect Gmail
                </Link>{" "}
                and incoming mail lands here every few minutes — handle, reply, or archive in one
                tap. Approving an email draft still copies it and opens your mail app to send;
                live send-on-approval is next.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
