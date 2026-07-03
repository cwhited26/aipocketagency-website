"use client"

// VoiceAppClient — the call list + "Make a call" dialer for the Voice App (PA-CHAN-16).
// Polls the list every 3s while any call is live and stops when everything is terminal —
// the Browser Agent poll pattern, no sockets.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { VoiceCallListView } from "@/lib/channels/voice/realtime/views"

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#22d3ee]/60 focus:outline-none"
const LABEL_CLASS = "block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5"

const LIVE_STATUSES = new Set(["ringing", "in_progress"])

const STATUS_STYLE: Record<string, string> = {
  ringing: "text-slate-300 border-slate-600",
  in_progress: "text-[#22d3ee] border-[#22d3ee]/40",
  completed: "text-emerald-300 border-emerald-400/40",
  failed: "text-rose-300 border-rose-400/40",
  no_answer: "text-slate-500 border-slate-700",
}

const STATUS_LABEL: Record<string, string> = {
  ringing: "Ringing",
  in_progress: "On the call",
  completed: "Completed",
  failed: "Failed",
  no_answer: "No answer",
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "—"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function VoiceAppClient(props: {
  unlocked: boolean
  enabled: boolean
  initialCalls: VoiceCallListView[]
  prefillNumber: string
}) {
  const router = useRouter()
  const [calls, setCalls] = useState<VoiceCallListView[]>(props.initialCalls)
  const [modalOpen, setModalOpen] = useState(props.prefillNumber !== "")

  const hasLive = useMemo(() => calls.some((c) => LIVE_STATUSES.has(c.status)), [calls])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch("/api/app/apps/voice/calls", { cache: "no-store" })
    if (!res.ok) return
    const data = (await res.json()) as { calls?: VoiceCallListView[] }
    if (Array.isArray(data.calls)) setCalls(data.calls)
  }, [])

  useEffect(() => {
    if (!props.unlocked || !hasLive) return undefined
    timerRef.current = setInterval(() => void refresh(), 3_000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [hasLive, props.unlocked, refresh])

  if (!props.unlocked) {
    return (
      <div className="h-full overflow-y-auto bg-[#06080b]">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <Header />
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-6 py-6">
            <p className="text-sm font-semibold text-slate-100">Voice is part of the Studio+ plan.</p>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              A live call runs realtime audio both directions — the most expensive thing we
              operate. Upgrade and Poc picks up your line, makes calls when you ask, and stages
              anything consequential for your approval.
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

        {!props.enabled ? (
          <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
            <p className="text-sm text-amber-200">
              Voice isn&apos;t switched on for this workspace yet. Your call history stays here;
              the dialer unlocks when it goes live.
            </p>
          </div>
        ) : null}

        <div className="mb-6 flex items-center justify-between">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
            {calls.length === 0 ? "No calls yet" : `${calls.length} call${calls.length === 1 ? "" : "s"}`}
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={!props.enabled}
            className="rounded-lg border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-4 py-2 text-sm font-medium text-[#22d3ee] hover:bg-[#22d3ee]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Make a call
          </button>
        </div>

        {calls.length === 0 ? (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-6 py-8 text-center">
            <p className="text-sm text-slate-300 leading-relaxed">
              When your line rings, Poc picks up. When you need someone called, Poc dials. Every
              call lands here with the full transcript, and anything a call would change waits in
              your Inbox first.
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Try: &quot;Make a call&quot; → your supplier → &quot;confirm Thursday&apos;s delivery window.&quot;
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {calls.map((call) => (
              <li key={call.id}>
                <Link
                  href={`/app/apps/voice/${call.id}`}
                  className="block rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 hover:border-slate-500/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-100 truncate">
                        <span className="font-mono text-slate-400 mr-2">
                          {call.direction === "inbound" ? "IN" : "OUT"}
                        </span>
                        {call.counterparty}
                      </p>
                      {call.purpose ? (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{call.purpose}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-500">{formatDuration(call.durationSeconds)}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-mono ${STATUS_STYLE[call.status] ?? "text-slate-400 border-slate-700"}`}
                      >
                        {STATUS_LABEL[call.status] ?? call.status}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {modalOpen ? (
          <DialerModal
            prefillNumber={props.prefillNumber}
            onClose={() => setModalOpen(false)}
            onPlaced={(callId) => router.push(`/app/apps/voice/${callId}`)}
          />
        ) : null}
      </div>
    </div>
  )
}

function Header() {
  return (
    <div className="mb-8">
      <p className="text-[11px] font-mono uppercase tracking-wider text-[#22d3ee] mb-2">Voice</p>
      <h1 className="text-xl font-semibold text-slate-100">
        Poc answers your phone. And makes calls when you ask.
      </h1>
      <p className="text-sm text-slate-400 mt-2 leading-relaxed">
        Anything a call would change — an email, a booking — waits for your approval. Hard caps on
        every call: 30 minutes, $5, 10 calls a day.
      </p>
    </div>
  )
}

function DialerModal(props: {
  prefillNumber: string
  onClose: () => void
  onPlaced: (callId: string) => void
}) {
  const [to, setTo] = useState(props.prefillNumber)
  const [purpose, setPurpose] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    const res = await fetch("/api/app/apps/voice/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: to.trim(), purpose: purpose.trim() }),
    })
    const data = (await res.json().catch(() => ({}))) as { callId?: string; error?: string }
    if (!res.ok || !data.callId) {
      setError(data.error ?? "The call couldn't be placed. Try again.")
      setSubmitting(false)
      return
    }
    props.onPlaced(data.callId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-[#0a0d12] p-6">
        <h2 className="text-base font-semibold text-slate-100 mb-4">Poc, make a call</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="voice-dial-to" className={LABEL_CLASS}>
              Number
            </label>
            <input
              id="voice-dial-to"
              className={FIELD_CLASS}
              placeholder="+14045551234"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="voice-dial-purpose" className={LABEL_CLASS}>
              What&apos;s the call for
            </label>
            <textarea
              id="voice-dial-purpose"
              className={`${FIELD_CLASS} min-h-[72px] resize-y`}
              placeholder="Confirm Thursday's delivery window with the supplier."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || to.trim() === "" || purpose.trim().length < 3}
              className="rounded-lg border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-4 py-2 text-sm font-medium text-[#22d3ee] hover:bg-[#22d3ee]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Dialing…" : "Place the call"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
