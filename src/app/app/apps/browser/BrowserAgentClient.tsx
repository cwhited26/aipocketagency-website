"use client"

// BrowserAgentClient — the job list + New Job modal for the Browser Agent App (PA-POS-19).
// Polls the list every 3s while any job is live (queued / running / awaiting_approval) and
// stops when everything is terminal — no sockets, just the poll the SPEC calls for.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import type { JobListView } from "@/lib/browser-agent/views"
import type { BrowserAgentJobLimits } from "@/lib/personas/tier-caps"

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#22d3ee]/60 focus:outline-none"
const LABEL_CLASS = "block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5"

const LIVE_STATUSES = new Set(["queued", "running", "awaiting_approval"])

const STATUS_STYLE: Record<string, string> = {
  queued: "text-slate-300 border-slate-600",
  running: "text-[#22d3ee] border-[#22d3ee]/40",
  awaiting_approval: "text-amber-300 border-amber-400/40",
  completed: "text-emerald-300 border-emerald-400/40",
  failed: "text-rose-300 border-rose-400/40",
  canceled: "text-slate-500 border-slate-700",
}

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  awaiting_approval: "Waiting on you",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled",
}

type PersonaOption = { id: string; name: string }

export default function BrowserAgentClient(props: {
  unlocked: boolean
  initialJobs: JobListView[]
  personas: PersonaOption[]
  limits: BrowserAgentJobLimits
}) {
  const [jobs, setJobs] = useState<JobListView[]>(props.initialJobs)
  const [modalOpen, setModalOpen] = useState(false)

  const hasLive = useMemo(() => jobs.some((j) => LIVE_STATUSES.has(j.status)), [jobs])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch("/api/app/apps/browser/jobs", { cache: "no-store" })
    if (!res.ok) return
    const data = (await res.json()) as { jobs?: JobListView[] }
    if (Array.isArray(data.jobs)) setJobs(data.jobs)
  }, [])

  useEffect(() => {
    if (!props.unlocked) return
    if (hasLive) {
      timerRef.current = setInterval(() => void refresh(), 3_000)
      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
    return undefined
  }, [hasLive, props.unlocked, refresh])

  if (!props.unlocked) {
    return (
      <div className="h-full overflow-y-auto bg-[#06080b]">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <Header />
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-6 py-6">
            <p className="text-sm font-semibold text-slate-100">
              The Browser Agent is part of the AI Agent Workspace plan.
            </p>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Every job runs a real hosted browser for up to an hour — that&apos;s why it sits on
              the $497 plan. Upgrade and your agent starts operating the sites your other tools
              can&apos;t reach.
            </p>
            <Link
              href="/pricing"
              className="mt-4 inline-flex items-center rounded-lg border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-4 py-2 text-sm font-medium text-[#22d3ee] hover:bg-[#22d3ee]/20 transition-colors"
            >
              See plans →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Header />

        <div className="mb-6 flex items-center justify-between">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
            {jobs.length === 0 ? "No jobs yet" : `${jobs.length} job${jobs.length === 1 ? "" : "s"}`}
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-lg border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-4 py-2 text-sm font-medium text-[#22d3ee] hover:bg-[#22d3ee]/20 transition-colors"
          >
            New job
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-6 py-8 text-center">
            <p className="text-sm text-slate-300 leading-relaxed">
              Point it at a page, say what needs doing, and watch the step-by-step record come
              back — a screenshot for every move, and a card for anything irreversible.
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Try: &quot;Pull the current permit fee schedule from this county portal.&quot;
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/app/apps/browser/${job.id}`}
                className="block rounded-xl border border-slate-700/60 bg-slate-900/60 px-5 py-4 hover:border-[#22d3ee]/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-100 leading-snug">{job.intent}</p>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${STATUS_STYLE[job.status] ?? "text-slate-400 border-slate-700"}`}
                  >
                    {STATUS_LABEL[job.status] ?? job.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 truncate">{job.startingUrl}</p>
                <div className="mt-2 flex items-center gap-4 text-[11px] font-mono text-slate-500">
                  <span>
                    step {job.currentStep}/{job.maxSteps}
                  </span>
                  <span>{job.costUsd} spent</span>
                  {job.status === "awaiting_approval" && (
                    <span className="text-amber-300">a step is waiting for your OK</span>
                  )}
                </div>
                {job.error && <p className="mt-2 text-xs text-rose-300">{job.error}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <NewJobModal
          personas={props.personas}
          limits={props.limits}
          onClose={() => setModalOpen(false)}
          onCreated={(job) => {
            setJobs((prev) => [job, ...prev])
            setModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

function Header() {
  return (
    <div className="mb-8">
      <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
        Operates tools without APIs
      </div>
      <h1 className="text-2xl font-bold text-slate-100">Browser Agent</h1>
      <p className="text-slate-300 text-sm mt-2 leading-relaxed">
        Plenty of the tools your business runs on have no connection to anything — county permit
        portals, supplier order pages, carrier dashboards. Your agent opens a real browser and
        clicks through them the way you would. Every step lands here with a screenshot, and
        anything irreversible — a form submit, a purchase, a delete — waits for your approval
        first.
      </p>
    </div>
  )
}

function NewJobModal(props: {
  personas: PersonaOption[]
  limits: BrowserAgentJobLimits
  onClose: () => void
  onCreated: (job: JobListView) => void
}) {
  const [intent, setIntent] = useState("")
  const [startingUrl, setStartingUrl] = useState("")
  const [personaId, setPersonaId] = useState<string>("")
  const [maxSteps, setMaxSteps] = useState(50)
  const [maxWallMinutes, setMaxWallMinutes] = useState(30)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<string | null>(null)

  const stepCeiling = props.limits.maxSteps
  const minuteCeiling = Math.floor(props.limits.maxWallSeconds / 60)

  async function submit() {
    setSubmitting(true)
    setError(null)
    setSuggestion(null)
    try {
      const res = await fetch("/api/app/apps/browser/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: intent.trim(),
          startingUrl: startingUrl.trim(),
          agentPersonaId: personaId || null,
          maxSteps,
          maxWallSeconds: maxWallMinutes * 60,
        }),
      })
      const data = (await res.json()) as {
        job?: JobListView
        error?: string
        suggestion?: string
      }
      if (!res.ok || !data.job) {
        setError(data.error ?? "Could not create the job.")
        if (data.suggestion) setSuggestion(data.suggestion)
        return
      }
      props.onCreated(data.job)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = intent.trim().length >= 8 && /^https?:\/\//.test(startingUrl.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0b0f14] p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">New browser job</h2>
          <button
            type="button"
            onClick={props.onClose}
            className="text-slate-500 hover:text-slate-300 text-sm font-mono"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={LABEL_CLASS} htmlFor="ba-url">
              Starting page
            </label>
            <input
              id="ba-url"
              className={FIELD_CLASS}
              placeholder="https://…"
              value={startingUrl}
              onChange={(e) => setStartingUrl(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="ba-intent">
              What needs doing
            </label>
            <textarea
              id="ba-intent"
              className={`${FIELD_CLASS} min-h-[90px]`}
              placeholder="Pull the current fee schedule from the permits section and note the residential reroof line."
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="ba-persona">
              Persona
            </label>
            <select
              id="ba-persona"
              className={FIELD_CLASS}
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
            >
              <option value="">No persona (run as your agent)</option>
              {props.personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="ba-steps">
              Max steps — {maxSteps}
            </label>
            <input
              id="ba-steps"
              type="range"
              min={10}
              max={stepCeiling}
              step={5}
              value={maxSteps}
              onChange={(e) => setMaxSteps(Number(e.target.value))}
              className="w-full accent-[#22d3ee]"
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="ba-minutes">
              Time limit — {maxWallMinutes} min
            </label>
            <input
              id="ba-minutes"
              type="range"
              min={5}
              max={minuteCeiling}
              step={5}
              value={maxWallMinutes}
              onChange={(e) => setMaxWallMinutes(Number(e.target.value))}
              className="w-full accent-[#22d3ee]"
            />
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Hard cost cap: ${(props.limits.maxCostCents / 100).toFixed(2)} per job on your plan —
            the job halts before it can spend past it. Your agent never enters passwords;
            sign-ins, form submits, purchases, and deletes all wait for your approval.
          </p>

          {error && (
            <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-3">
              <p className="text-sm text-rose-200">{error}</p>
              {suggestion && <p className="text-sm text-rose-200/80 mt-1">{suggestion}</p>}
            </div>
          )}

          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={() => void submit()}
            className="w-full rounded-lg border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-4 py-2.5 text-sm font-medium text-[#22d3ee] hover:bg-[#22d3ee]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Starting…" : "Start the job"}
          </button>
        </div>
      </div>
    </div>
  )
}
