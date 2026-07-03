"use client"

// CallDetailClient — live view of one voice call (PA-CHAN-16): streaming transcript (speech
// events while live, the finalized transcript after), the staged-approval queue, speak-as-Poc
// for outbound calls, and the hang-up button. Polls every 2.5s while the call is live.

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import type { VoiceCallDetailView } from "@/lib/channels/voice/realtime/views"

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#22d3ee]/60 focus:outline-none"

type SpeechLine = { key: string; role: string; text: string }

function speechLines(call: VoiceCallDetailView): SpeechLine[] {
  // Finalized transcript wins; while live, render the speech events as the stream.
  if (call.transcript.length > 0) {
    return call.transcript.map((t, i) => ({ key: `t-${i}`, role: t.role, text: t.text }))
  }
  return call.events
    .filter((e) => e.type === "speech")
    .map((e) => ({
      key: e.id,
      role: typeof e.payload.role === "string" ? e.payload.role : "poc",
      text: typeof e.payload.text === "string" ? e.payload.text : "",
    }))
    .filter((l) => l.text !== "")
}

const ROLE_LABEL: Record<string, string> = {
  poc: "Poc",
  caller: "Caller",
  owner_line: "You (as Poc)",
}

export default function CallDetailClient(props: { initial: VoiceCallDetailView }) {
  const [call, setCall] = useState<VoiceCallDetailView>(props.initial)
  const [line, setLine] = useState("")
  const [sending, setSending] = useState(false)
  const [hangingUp, setHangingUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/app/apps/voice/calls/${props.initial.id}`, { cache: "no-store" })
    if (!res.ok) return
    const data = (await res.json()) as { call?: VoiceCallDetailView }
    if (data.call) setCall(data.call)
  }, [props.initial.id])

  useEffect(() => {
    if (!call.live) return undefined
    timerRef.current = setInterval(() => void refresh(), 2_500)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [call.live, refresh])

  const sendLine = async () => {
    const text = line.trim()
    if (text === "") return
    setSending(true)
    setError(null)
    const res = await fetch(`/api/app/apps/voice/calls/${props.initial.id}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? "Couldn't queue the line.")
    } else {
      setLine("")
    }
    setSending(false)
  }

  const hangUp = async () => {
    setHangingUp(true)
    setError(null)
    const res = await fetch(`/api/app/apps/voice/calls/${props.initial.id}`, { method: "DELETE" })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? "Couldn't end the call.")
      setHangingUp(false)
      return
    }
    await refresh()
    setHangingUp(false)
  }

  const lines = speechLines(call)

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-6">
          <Link href="/app/apps/voice" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← All calls
          </Link>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#22d3ee] mb-1">
                {call.direction === "inbound" ? "Inbound call" : "Outbound call"}
              </p>
              <h1 className="text-lg font-semibold text-slate-100">{call.counterparty}</h1>
              {call.purpose ? <p className="text-sm text-slate-400 mt-1">{call.purpose}</p> : null}
            </div>
            {call.live ? (
              <button
                type="button"
                onClick={() => void hangUp()}
                disabled={hangingUp}
                className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-300 hover:bg-rose-400/20 transition-colors disabled:opacity-40"
              >
                {hangingUp ? "Ending…" : "Hang up"}
              </button>
            ) : (
              <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] font-mono text-slate-400">
                {call.status}
              </span>
            )}
          </div>
        </div>

        {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}

        {call.functionCalls.length > 0 ? (
          <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
            <p className="text-[11px] font-mono uppercase tracking-wider text-amber-300 mb-2">
              Staged on this call — waiting on you
            </p>
            <ul className="space-y-1.5">
              {call.functionCalls.map((fc, i) => (
                <li key={`fc-${i}`} className="text-sm text-slate-200">
                  <span className="font-mono text-amber-200">{fc.name}</span>
                  <span className="text-slate-400"> — {fc.outcome === "staged" ? "in your Inbox" : fc.outcome}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/app/mission-control"
              className="mt-2 inline-block text-sm text-[#22d3ee] hover:underline"
            >
              Review in Mission Control →
            </Link>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-3">
            Transcript {call.live ? "· live" : ""}
          </p>
          {lines.length === 0 ? (
            <p className="text-sm text-slate-500">
              {call.live ? "Waiting for the first words…" : "No transcript was captured for this call."}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {lines.map((l) => (
                <li key={l.key} className="text-sm leading-relaxed">
                  <span
                    className={`font-mono text-[11px] uppercase tracking-wider mr-2 ${l.role === "poc" ? "text-[#22d3ee]" : l.role === "owner_line" ? "text-amber-300" : "text-slate-400"}`}
                  >
                    {ROLE_LABEL[l.role] ?? l.role}
                  </span>
                  <span className="text-slate-200">{l.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {call.live && call.direction === "outbound" ? (
          <div className="mt-4">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
              Feed Poc a line
            </p>
            <div className="flex gap-2">
              <input
                className={FIELD_CLASS}
                placeholder="Poc reads whatever you type, as its next turn."
                value={line}
                onChange={(e) => setLine(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendLine()
                }}
              />
              <button
                type="button"
                onClick={() => void sendLine()}
                disabled={sending || line.trim() === ""}
                className="shrink-0 rounded-lg border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-4 py-2 text-sm font-medium text-[#22d3ee] hover:bg-[#22d3ee]/20 transition-colors disabled:opacity-40"
              >
                {sending ? "Queuing…" : "Say it"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
