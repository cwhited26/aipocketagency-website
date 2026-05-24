"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type PendingActionStatus =
  | "pending"
  | "approved"
  | "executing"
  | "executed"
  | "rejected"
  | "failed";

type PendingAction = {
  id: string;
  action_type: "update_brain_memory";
  status: PendingActionStatus;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  decided_at: string | null;
  executed_at: string | null;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusBadge(status: PendingActionStatus) {
  const styles: Record<PendingActionStatus, string> = {
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    approved: "bg-teal-500/15 text-teal-400 border-teal-500/30",
    executing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    executed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    rejected: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  const labels: Record<PendingActionStatus, string> = {
    pending: "Pending",
    approved: "Approved",
    executing: "Executing",
    executed: "Done",
    rejected: "Rejected",
    failed: "Failed",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono tracking-wider uppercase ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function PayloadPreview({ payload }: { payload: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const content = typeof payload.content === "string" ? payload.content : "";
  const path = typeof payload.path === "string" ? payload.path : "";
  const mode = typeof payload.mode === "string" ? payload.mode : "";
  const preview = content.length > 300 && !expanded ? content.slice(0, 300) + "…" : content;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          {path}
        </span>
        {mode && (
          <span className="text-[10px] font-mono text-[#22d3ee]/50 uppercase tracking-wider">
            · {mode}
          </span>
        )}
      </div>
      <pre className="text-xs text-slate-300 bg-slate-950/60 border border-slate-800/50 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
        {preview}
      </pre>
      {content.length > 300 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {expanded ? "Show less" : `Show all ${content.length} chars`}
        </button>
      )}
    </div>
  );
}

function PendingCard({
  action,
  onApprove,
  onReject,
}: {
  action: PendingAction;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleApprove() {
    setBusy("approve");
    setErr(null);
    try {
      await onApprove(action.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    setBusy("reject");
    setErr(null);
    try {
      await onReject(action.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-slate-900/60 p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono text-amber-400/70 uppercase tracking-[0.2em]">
            Agent proposal
          </span>
          {statusBadge(action.status)}
        </div>
        <span className="text-[11px] text-slate-600 shrink-0">{relativeTime(action.created_at)}</span>
      </div>

      <p className="text-sm font-semibold text-slate-100 mt-1">{action.title}</p>
      <p className="text-sm text-slate-400 mt-1 leading-relaxed">{action.summary}</p>

      <PayloadPreview payload={action.payload} />

      {err && (
        <p className="mt-3 text-xs text-red-400 font-mono">{err}</p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleApprove}
          disabled={busy !== null}
          className="flex-1 py-2 px-4 rounded-lg bg-[#22d3ee]/10 hover:bg-[#22d3ee]/20 border border-[#22d3ee]/30 hover:border-[#22d3ee]/60 text-[#22d3ee] text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          onClick={handleReject}
          disabled={busy !== null}
          className="flex-1 py-2 px-4 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 hover:border-slate-600/60 text-slate-300 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </div>
  );
}

function HistoryRow({ action }: { action: PendingAction }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-slate-800/50 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 py-3 text-left group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-slate-300 truncate">{action.title}</span>
          {statusBadge(action.status)}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-600">
            {action.decided_at ? relativeTime(action.decided_at) : relativeTime(action.created_at)}
          </span>
          <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs">
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>
      {open && (
        <div className="pb-3">
          <p className="text-sm text-slate-400 mb-2">{action.summary}</p>
          {action.status === "executed" && action.result && (
            <p className="text-xs font-mono text-emerald-400/70">
              Committed: {typeof action.result.sha === "string" ? action.result.sha.slice(0, 7) : "—"}
            </p>
          )}
          {action.status === "failed" && action.error && (
            <p className="text-xs font-mono text-red-400/70">{action.error}</p>
          )}
          <PayloadPreview payload={action.payload} />
        </div>
      )}
    </div>
  );
}

export default function InboxClient({ brainRepo }: { brainRepo: string | null }) {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadActions = useCallback(async () => {
    try {
      const res = await fetch("/api/app/actions", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load actions (${res.status})`);
      const data = (await res.json()) as { actions: PendingAction[] };
      setActions(data.actions);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActions();
  }, [loadActions]);

  const pending = actions.filter((a) => a.status === "pending");
  const history = actions.filter((a) => a.status !== "pending");

  async function handleApprove(id: string) {
    const res = await fetch(`/api/app/actions/${id}/approve`, {
      method: "POST",
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      throw new Error(body.error ?? `Approve failed (${res.status})`);
    }
    const body = (await res.json()) as { action?: PendingAction };
    if (body.action) {
      setActions((prev) => prev.map((a) => (a.id === id ? body.action! : a)));
    }
  }

  async function handleReject(id: string) {
    const res = await fetch(`/api/app/actions/${id}/reject`, {
      method: "POST",
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      throw new Error(body.error ?? `Reject failed (${res.status})`);
    }
    const body = (await res.json()) as { action?: PendingAction };
    if (body.action) {
      setActions((prev) => prev.map((a) => (a.id === id ? body.action! : a)));
    }
  }

  return (
    <div className="min-h-screen bg-[#05070a]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-2">
          <Link
            href="/app/apps"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Work apps
          </Link>
        </div>

        <div className="mb-8">
          <div className="text-[10px] text-[#22d3ee]/60 font-mono tracking-[0.2em] uppercase mb-2">
            Agent desk · Approval queue
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Inbox</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            When your agent wants to update your brain or take an action, it stages a proposal here.
            You review it, then approve or reject — nothing executes without your explicit yes.
          </p>
        </div>

        {/* Pending queue */}
        <section className="mb-8">
          <div className="text-[11px] font-mono text-slate-600 uppercase tracking-wider mb-3">
            Pending approval{pending.length > 0 ? ` · ${pending.length}` : ""}
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-6 py-8 text-center">
              <p className="text-slate-500 text-sm">Loading…</p>
            </div>
          ) : fetchError ? (
            <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-6 py-6">
              <p className="text-red-400 text-sm font-mono">{fetchError}</p>
            </div>
          ) : pending.length === 0 ? (
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-6 py-8 text-center">
              <div className="text-[#22d3ee]/30 font-mono text-xs tracking-[0.2em] uppercase mb-3">
                Queue
              </div>
              <div className="text-slate-100 text-sm font-medium mb-2">
                0 items pending approval
              </div>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                Talk to your agent in a conversation. When it decides your brain should be updated,
                it proposes the change here for you to review before anything is written.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((action) => (
                <PendingCard
                  key={action.id}
                  action={action}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}
        </section>

        {/* Quick-draft links */}
        {pending.length === 0 && !loading && (
          <div className="mb-8">
            <div className="text-[11px] font-mono text-slate-600 uppercase tracking-wider mb-3">
              Start a conversation
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { href: "/app/ask", label: "Talk to your agent", desc: "Share context or ask anything" },
                { href: "/app/apps/quote", label: "Draft a quote", desc: "Proposal ready to approve" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="glow-card px-4 py-3"
                >
                  <div className="text-sm font-medium text-slate-200 mb-0.5">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <section>
            <div className="text-[11px] font-mono text-slate-600 uppercase tracking-wider mb-3">
              History
            </div>
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-5 divide-y divide-slate-800/50">
              {history.map((action) => (
                <HistoryRow key={action.id} action={action} />
              ))}
            </div>
          </section>
        )}

        {/* Honest seam */}
        <div className="mt-8 rounded-xl border border-slate-800/40 bg-transparent px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-400">
                Live email and calendar arrive with Connections
              </p>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                The approval desk above is live now — your agent proposes brain updates here and you
                control what gets written.{" "}
                {brainRepo
                  ? "Once you connect Gmail, your agent will also parse your inbox for action items and stage them here."
                  : "Connect your accounts in Settings → Connections to expand what your agent can propose."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
