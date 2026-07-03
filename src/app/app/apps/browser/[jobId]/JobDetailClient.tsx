"use client"

// JobDetailClient — the live step timeline for one Browser Agent job. Polls every 3s while the
// job is live; each step shows the screenshot, the action, and the agent's reasoning. Approval
// steps carry Approve / Reject buttons that resolve through the same route as Mission Control
// (one approval path, two surfaces).

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { JobDetailView, StepView } from "@/lib/browser-agent/views"

const LIVE_STATUSES = new Set(["queued", "running", "awaiting_approval"])

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  awaiting_approval: "Waiting on you",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled",
}

const KIND_LABEL: Record<string, string> = {
  click: "Click",
  type: "Type",
  key: "Key press",
  screenshot: "Screenshot",
  navigate: "Navigate",
  scroll: "Scroll",
  wait: "Wait",
  awaiting_approval: "Held for approval",
}

export default function JobDetailClient(props: { initialJob: JobDetailView }) {
  const [job, setJob] = useState<JobDetailView>(props.initialJob)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const live = useMemo(() => LIVE_STATUSES.has(job.status), [job.status])

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/app/apps/browser/jobs/${props.initialJob.id}`, {
      cache: "no-store",
    })
    if (!res.ok) return
    const data = (await res.json()) as { job?: JobDetailView }
    if (data.job) setJob(data.job)
  }, [props.initialJob.id])

  useEffect(() => {
    if (!live) return undefined
    const timer = setInterval(() => void refresh(), 3_000)
    return () => clearInterval(timer)
  }, [live, refresh])

  async function decide(inboxItemId: string, decision: "approve" | "reject") {
    setActing(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/orchestrator/approvals/${inboxItemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setActionError(data.error ?? "Could not record your decision.")
        return
      }
      await refresh()
    } finally {
      setActing(false)
    }
  }

  async function cancelJob() {
    setActing(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/app/apps/browser/jobs/${job.id}/cancel`, { method: "POST" })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setActionError(data.error ?? "Could not cancel the job.")
        return
      }
      await refresh()
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link
          href="/app/apps/browser"
          className="text-[11px] font-mono text-[#22d3ee]/60 hover:text-[#22d3ee] transition-colors"
        >
          ← All jobs
        </Link>

        <div className="mt-4 mb-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-slate-100 leading-snug">{job.intent}</h1>
            <span className="shrink-0 rounded border border-slate-600 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-300">
              {STATUS_LABEL[job.status] ?? job.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 break-all">{job.startingUrl}</p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-400">
            <span>
              step {job.currentStep}/{job.maxSteps}
            </span>
            <span>
              {job.costUsd} spent · halts at {job.costCapUsd}
            </span>
            {live && (
              <button
                type="button"
                disabled={acting}
                onClick={() => void cancelJob()}
                className="rounded border border-rose-400/40 px-2 py-0.5 text-rose-300 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
              >
                Cancel job
              </button>
            )}
          </div>
        </div>

        {job.resultSummary && (
          <div className="mb-5 rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-5 py-4">
            <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-300/70 mb-1">
              Result
            </p>
            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
              {job.resultSummary}
            </p>
          </div>
        )}
        {job.error && (
          <div className="mb-5 rounded-xl border border-rose-400/30 bg-rose-500/5 px-5 py-4">
            <p className="text-sm text-rose-200">{job.error}</p>
          </div>
        )}
        {actionError && (
          <div className="mb-5 rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-3">
            <p className="text-sm text-rose-200">{actionError}</p>
          </div>
        )}

        <div className="space-y-3">
          {job.steps.length === 0 && (
            <p className="text-sm text-slate-500">
              No steps yet — the first one lands after the next worker pass.
            </p>
          )}
          {job.steps.map((step) => (
            <StepCard
              key={step.stepNumber}
              step={step}
              acting={acting}
              onDecide={(decision) =>
                step.inboxItemId ? void decide(step.inboxItemId, decision) : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function StepCard(props: {
  step: StepView
  acting: boolean
  onDecide: (decision: "approve" | "reject") => void
}) {
  const { step } = props
  const held = step.actionKind === "awaiting_approval"
  const pending = held && step.approvalStatus === "pending"

  return (
    <div
      className={`rounded-xl border px-5 py-4 ${
        pending
          ? "border-amber-400/40 bg-amber-500/5"
          : "border-slate-700/60 bg-slate-900/60"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
          Step {step.stepNumber} · {KIND_LABEL[step.actionKind] ?? step.actionKind}
        </p>
        {held && step.approvalStatus && step.approvalStatus !== "pending" && (
          <span
            className={`text-[10px] font-mono uppercase tracking-wider ${
              step.approvalStatus === "approved" ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {step.approvalStatus}
          </span>
        )}
      </div>

      {step.reasoning && (
        <p className="mt-2 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {step.reasoning}
        </p>
      )}

      <ActionSummary payload={step.actionPayload} />

      {step.screenshotUrl && (
        // Signed Storage URL with a 1h TTL — next/image's optimizer would cache a URL that
        // expires; a plain img renders the fresh signature each poll.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={step.screenshotUrl}
          alt={`Step ${step.stepNumber} screenshot`}
          className="mt-3 w-full rounded-lg border border-slate-700/60"
          loading="lazy"
        />
      )}

      {pending && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={props.acting}
            onClick={() => props.onDecide("approve")}
            className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
          >
            Approve this step
          </button>
          <button
            type="button"
            disabled={props.acting}
            onClick={() => props.onDecide("reject")}
            className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/20 transition-colors disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

function ActionSummary(props: { payload: Record<string, unknown> }) {
  const p = props.payload
  const parts: string[] = []
  if (typeof p.kind === "string") parts.push(p.kind)
  if (typeof p.url === "string") parts.push(p.url)
  if (typeof p.text === "string") parts.push(`"${String(p.text).slice(0, 60)}"`)
  if (typeof p.x === "number" && typeof p.y === "number") parts.push(`(${p.x}, ${p.y})`)
  if (typeof p.gateReason === "string") parts.push(String(p.gateReason))
  if (parts.length === 0) return null
  return (
    <p className="mt-2 text-xs font-mono text-slate-500 break-all">{parts.join(" · ")}</p>
  )
}
