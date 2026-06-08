"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Mascot from "@/components/Mascot";
import { TabGuide } from "../_components/TabGuide";
import { BRAIN_TASKS, getOpenBrainTasks } from "@/lib/brain-tasks";
import type { FreshnessResponse } from "@/app/api/app/brain/freshness/route";

// ─── Types (mirrors InboxClient, kept local so no Server→Client prop passing) ──

type PendingActionStatus =
  | "pending"
  | "approved"
  | "executing"
  | "executed"
  | "rejected"
  | "failed";

type PendingAction = {
  id: string;
  action_type: "update_brain_memory" | "routine_output";
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

// ─── Icons ─────────────────────────────────────────────────────────────────────

function CheckCircleIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
        <circle cx="9" cy="9" r="8.25" fill="rgba(34,211,238,0.12)" stroke="#22d3ee" strokeWidth="1.5" />
        <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
      <circle cx="9" cy="9" r="8.25" stroke="#334155" strokeWidth="1.5" />
    </svg>
  );
}

// ─── Approval row ──────────────────────────────────────────────────────────────

function ApprovalRow({
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

  const isRoutineOutput = action.action_type === "routine_output";
  const content =
    typeof action.payload?.content === "string" ? action.payload.content : "";
  const path =
    typeof action.payload?.path === "string" ? action.payload.path : "";
  const preview = content.length > 400 ? content.slice(0, 400) + "…" : content;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-slate-900/60 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-amber-400 shrink-0">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7.5 4.5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="7.5" cy="10" r="0.8" fill="currentColor" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[10px] font-mono text-amber-400/70 uppercase tracking-[0.18em]">
              {isRoutineOutput ? "Routine output" : "Agent proposal"}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-100 leading-snug">{action.title}</p>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">{action.summary}</p>
          {path && (
            <p className="text-[10px] font-mono text-slate-600 mt-1.5">{path}</p>
          )}
          {preview && (
            <pre className="text-xs text-slate-400 bg-slate-950/50 border border-slate-800/40 rounded-lg p-2.5 mt-2 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
              {preview}
            </pre>
          )}
        </div>
      </div>

      {err && <p className="text-xs text-red-400 font-mono px-1">{err}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => void handleApprove()}
          disabled={busy !== null}
          className="flex-1 py-3 px-3 rounded-lg bg-[#22d3ee]/10 hover:bg-[#22d3ee]/20 border border-[#22d3ee]/30 hover:border-[#22d3ee]/60 text-[#22d3ee] text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {busy === "approve" ? "…" : isRoutineOutput ? "Read" : "Approve"}
        </button>
        <button
          onClick={() => void handleReject()}
          disabled={busy !== null}
          className="flex-1 py-3 px-3 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {busy === "reject" ? "…" : isRoutineOutput ? "Dismiss" : "Reject"}
        </button>
      </div>
    </div>
  );
}

// ─── Brain todo row ────────────────────────────────────────────────────────────

function BrainTodoRow({ task }: { task: (typeof BRAIN_TASKS)[number] }) {
  return (
    <a
      href={task.link}
      className="flex items-start gap-3 px-3 py-3 rounded-xl border border-slate-800/50 bg-slate-900/40 hover:bg-slate-800/50 hover:border-slate-700/60 transition-all group"
    >
      <CheckCircleIcon done={false} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-200 group-hover:text-slate-100 transition-colors leading-snug">
            {task.label}
          </span>
          <span className="text-[10px] font-mono text-[#22d3ee]/60 shrink-0">
            +{task.points} pts
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{task.desc}</p>
      </div>
      <span className="text-slate-600 group-hover:text-slate-400 transition-colors shrink-0 mt-0.5 text-xs">
        →
      </span>
    </a>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[11px] font-mono text-slate-500 uppercase tracking-[0.16em]">
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] font-mono text-slate-600">· {count}</span>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function TasksClient({ brainRepo }: { brainRepo: string | null }) {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [freshness, setFreshness] = useState<FreshnessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const fetches: Promise<void>[] = [
        fetch("/api/app/actions", { cache: "no-store" })
          .then((r) => {
            if (!r.ok) throw new Error(`Actions load failed (${r.status})`);
            return r.json() as Promise<{ actions: PendingAction[] }>;
          })
          .then((d) => { setActions(d.actions); }),
      ];

      if (brainRepo) {
        fetches.push(
          fetch("/api/app/brain/freshness", { cache: "no-store" })
            .then((r) => r.ok ? r.json() as Promise<FreshnessResponse> : Promise.reject(new Error(`${r.status}`)))
            .then((d) => { setFreshness(d); })
            .catch(() => { /* freshness optional — don't block page */ })
        );
      }

      await Promise.all(fetches);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [brainRepo]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = actions.filter((a) => a.status === "pending");

  const openBrainTasks = freshness
    ? getOpenBrainTasks(freshness.areas.filter((a) => a.filled).map((a) => a.key))
    : brainRepo
    ? null  // still loading
    : [];   // no brain connected — show all as open

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

  const isEmpty = !loading && pending.length === 0 && (openBrainTasks?.length ?? 0) === 0;

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-5 py-7 flex flex-col gap-6">

        {/* Header */}
        <div>
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-1">
            What&apos;s on your plate
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Tasks</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            The things that need you — not your agent.
          </p>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          Your agent handles what it can on its own. What&apos;s left is the work only you can do:
          a draft it wrote that&apos;s waiting on your yes or no, and the setup steps that make it
          smarter about your business. Sign off on a proposal before it goes to Stoll, fill in your
          pricing so every quote comes out right, tell it your follow-up cadence. Clear what&apos;s
          here and your agent keeps moving. Let it pile up and everything behind it waits.
        </p>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Mascot state="working" size={80} />
            <p className="text-[12px] font-mono text-slate-500">loading your task list…</p>
          </div>
        ) : fetchError ? (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-5 py-4">
            <p className="text-sm text-red-400 font-mono">{fetchError}</p>
            <button
              onClick={() => void load()}
              className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-5 py-16 px-4 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ border: "1px solid rgba(34,211,238,0.2)", background: "rgba(34,211,238,0.05)" }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="9.5" stroke="#22d3ee" strokeWidth="1.3" opacity="0.5" />
                <path d="M7 11l2.5 2.5 5.5-5.5" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-slate-200">Nothing on your plate</p>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-xs">
                You&apos;re caught up. Your brain is built and no proposals are waiting.
              </p>
            </div>
            <Link
              href="/app/ask"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 px-4 py-2.5 text-sm font-mono text-slate-300 hover:text-slate-100 hover:bg-slate-700/60 transition-all min-h-[44px]"
            >
              Talk to your agent →
            </Link>
          </div>
        ) : (
          <>
            {/* Pending approvals */}
            {pending.length > 0 && (
              <section>
                <SectionLabel label="Pending approvals" count={pending.length} />
                <div className="flex flex-col gap-3">
                  {pending.map((action) => (
                    <ApprovalRow
                      key={action.id}
                      action={action}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  ))}
                </div>
                <p className="text-[11px] font-mono text-slate-600 mt-3 leading-relaxed">
                  Full history in{" "}
                  <Link href="/app/apps/inbox" className="text-[#22d3ee]/60 hover:text-[#22d3ee] transition-colors">
                    Inbox →
                  </Link>
                </p>
              </section>
            )}

            {/* Brain todos */}
            {openBrainTasks !== null && openBrainTasks.length > 0 && (
              <section>
                <SectionLabel label="Build your brain" count={openBrainTasks.length} />
                <div className="flex flex-col gap-2">
                  {openBrainTasks.map((task) => (
                    <BrainTodoRow key={task.id} task={task} />
                  ))}
                </div>
                <p className="text-[11px] font-mono text-slate-600 mt-3 leading-relaxed">
                  Each area you fill sharpens every draft your agent writes.{" "}
                  <Link href="/app/brain" className="text-[#22d3ee]/60 hover:text-[#22d3ee] transition-colors">
                    Brain overview →
                  </Link>
                </p>
              </section>
            )}
          </>
        )}

        {/* First-touch guide — what to ask, what this connects to, and a sample list */}
        <TabGuide
          promptsHeading="Try one of these"
          prompts={[
            "What do I personally need to do this week that you can't do for me?",
            "List the open steps on the Stoll deal that need me, not you",
            "What's still missing from my brain that would make your drafts better?",
          ]}
          worksWith={[
            {
              href: "/app/projects",
              label: "Projects",
              blurb: "Steps a plan hands back to you — sign a contract, send a deposit — show up as tasks.",
            },
            {
              href: "/app/brain",
              label: "Brain",
              blurb: "Setup steps here fill the gaps in what your agent knows about your business.",
            },
            {
              href: "/app/apps/inbox",
              label: "Inbox",
              blurb: "Approvals waiting on you live here too — the full queue with every draft.",
            },
          ]}
          exampleLabel="See an example task list"
          exampleNote="This is a sample. Your real approvals and setup steps appear above."
        >
          <div className="flex flex-col gap-2">
            <div className="rounded-xl border border-amber-500/20 bg-slate-950/50 p-3.5">
              <div className="text-[10px] font-mono text-amber-400/70 uppercase tracking-[0.18em]">
                Waiting on you
              </div>
              <p className="mt-1 text-sm font-medium text-slate-100">
                Approve the proposal before it goes to Alan Stoll
              </p>
              <p className="mt-0.5 text-[13px] text-slate-500 leading-relaxed">
                Your agent drafted it and is holding the send until you say go.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3.5">
              <div className="text-[10px] font-mono text-[#22d3ee]/60 uppercase tracking-[0.18em]">
                Build your brain
              </div>
              <p className="mt-1 text-sm font-medium text-slate-100">
                Add your pricing so every quote comes out right
              </p>
              <p className="mt-0.5 text-[13px] text-slate-500 leading-relaxed">
                Takes two minutes and sharpens every draft from here on.
              </p>
            </div>
          </div>
        </TabGuide>
      </div>
    </div>
  );
}
