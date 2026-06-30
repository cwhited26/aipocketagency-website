"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type HistoryPoint = { ok: boolean; responseMs: number | null }

export type WebsiteView = {
  id: string
  url: string
  checkIntervalSeconds: number
  alertOnStatusChange: boolean
  alertOnContentChange: boolean
  alertOnSlowResponse: boolean
  alertOnSslExpiryDays: number
  lastCheckAt: string | null
  lastStatus: number | null
  lastResponseMs: number | null
  lastSslExpiresAt: string | null
  isActive: boolean
  history: HistoryPoint[]
}

const FIELD_CLASS =
  "mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none"
const LABEL_CLASS = "text-[11px] font-mono text-slate-400 uppercase tracking-wider"

const INTERVALS: { value: number; label: string }[] = [
  { value: 300, label: "Every 5 minutes" },
  { value: 900, label: "Every 15 minutes" },
  { value: 3600, label: "Every hour" },
  { value: 21600, label: "Every 6 hours" },
]

function intervalLabel(seconds: number): string {
  return INTERVALS.find((i) => i.value === seconds)?.label ?? `Every ${Math.round(seconds / 60)} min`
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function relTime(iso: string | null): string {
  if (!iso) return "not yet checked"
  const then = new Date(iso).getTime()
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function uptimePct(history: HistoryPoint[]): number | null {
  if (history.length === 0) return null
  const up = history.filter((h) => h.ok).length
  return Math.round((up / history.length) * 100)
}

function Sparkline({ history }: { history: HistoryPoint[] }) {
  if (history.length === 0) {
    return <span className="text-[11px] text-slate-600">no checks yet</span>
  }
  const w = 120
  const h = 28
  const max = Math.max(1, ...history.map((p) => p.responseMs ?? 0))
  const step = history.length > 1 ? w / (history.length - 1) : w
  const pts = history
    .map((p, i) => {
      const y = h - ((p.responseMs ?? 0) / max) * (h - 4) - 2
      return `${(i * step).toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  return (
    <svg width={w} height={h} className="overflow-visible" role="img" aria-label="response time history">
      <polyline points={pts} fill="none" stroke="#22d3ee" strokeWidth="1.5" />
      {history.map((p, i) => (
        <circle
          key={i}
          cx={(i * step).toFixed(1)}
          cy={(h - ((p.responseMs ?? 0) / max) * (h - 4) - 2).toFixed(1)}
          r={p.ok ? 1.6 : 2.4}
          fill={p.ok ? "#22d3ee" : "#f87171"}
        />
      ))}
    </svg>
  )
}

function StatusBadge({ site }: { site: WebsiteView }) {
  if (!site.isActive) {
    return <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">Paused</span>
  }
  if (site.lastStatus === null) {
    return <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">Pending</span>
  }
  const up = site.lastStatus >= 200 && site.lastStatus < 400
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] ${
        up ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
      }`}
    >
      {up ? "Up" : "Down"} · {site.lastStatus}
    </span>
  )
}

function AddWebsite({ disabled, onAdded }: { disabled: boolean; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [interval, setIntervalSeconds] = useState(900)
  const [onStatus, setOnStatus] = useState(true)
  const [onContent, setOnContent] = useState(false)
  const [onSlow, setOnSlow] = useState(true)
  const [sslDays, setSslDays] = useState(14)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch("/api/app/apps/website-monitor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: url.trim(),
        checkIntervalSeconds: interval,
        alertOnStatusChange: onStatus,
        alertOnContentChange: onContent,
        alertOnSlowResponse: onSlow,
        alertOnSslExpiryDays: sslDays,
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
      setError(data.message ?? data.error ?? "Could not add this URL.")
      return
    }
    setUrl("")
    setOpen(false)
    onAdded()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full rounded-xl border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-300 hover:border-[#22d3ee]/50 hover:text-[#22d3ee] disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Watch a website
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <label className="block">
        <span className={LABEL_CLASS}>Website URL</span>
        <input
          className={FIELD_CLASS}
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>

      <label className="mt-4 block">
        <span className={LABEL_CLASS}>Check frequency</span>
        <select className={FIELD_CLASS} value={interval} onChange={(e) => setIntervalSeconds(Number(e.target.value))}>
          {INTERVALS.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="mt-4">
        <span className={LABEL_CLASS}>Alert me when…</span>
        <div className="mt-2 flex flex-col gap-2">
          <Toggle checked={onStatus} onChange={setOnStatus} label="Status changes (up ↔ down)" />
          <Toggle checked={onSlow} onChange={setOnSlow} label="Response is slow (over 3s)" />
          <Toggle checked={onContent} onChange={setOnContent} label="Page content changes" />
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className={LABEL_CLASS}>SSL expiry warning (days before; 0 = off)</span>
        <input
          type="number"
          min={0}
          max={365}
          className={FIELD_CLASS}
          value={sslDays}
          onChange={(e) => setSslDays(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
        />
      </label>

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !url.trim()}
          className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-[#22d3ee]/90 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Start watching"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:text-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#22d3ee]" />
      {label}
    </label>
  )
}

function WebsiteRow({ site, onChanged }: { site: WebsiteView; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [interval, setIntervalSeconds] = useState(site.checkIntervalSeconds)
  const [onStatus, setOnStatus] = useState(site.alertOnStatusChange)
  const [onContent, setOnContent] = useState(site.alertOnContentChange)
  const [onSlow, setOnSlow] = useState(site.alertOnSlowResponse)
  const [sslDays, setSslDays] = useState(site.alertOnSslExpiryDays)

  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    await fetch(`/api/app/apps/website-monitor/${site.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    setBusy(false)
    onChanged()
  }

  async function remove() {
    setBusy(true)
    await fetch(`/api/app/apps/website-monitor/${site.id}`, { method: "DELETE" })
    setBusy(false)
    onChanged()
  }

  const pct = uptimePct(site.history)

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge site={site} />
            <a
              href={site.url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm font-semibold text-slate-100 hover:text-[#22d3ee]"
            >
              {hostOf(site.url)}
            </a>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {intervalLabel(site.checkIntervalSeconds)} · checked {relTime(site.lastCheckAt)}
            {site.lastResponseMs !== null && ` · ${site.lastResponseMs}ms`}
            {pct !== null && ` · ${pct}% up`}
          </p>
        </div>
        <Sparkline history={site.history} />
      </div>

      {editing && (
        <div className="mt-4 border-t border-slate-800 pt-4">
          <label className="block">
            <span className={LABEL_CLASS}>Check frequency</span>
            <select
              className={FIELD_CLASS}
              value={interval}
              onChange={(e) => setIntervalSeconds(Number(e.target.value))}
            >
              {INTERVALS.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 flex flex-col gap-2">
            <Toggle checked={onStatus} onChange={setOnStatus} label="Status changes (up ↔ down)" />
            <Toggle checked={onSlow} onChange={setOnSlow} label="Response is slow (over 3s)" />
            <Toggle checked={onContent} onChange={setOnContent} label="Page content changes" />
          </div>
          <label className="mt-3 block">
            <span className={LABEL_CLASS}>SSL expiry warning (days; 0 = off)</span>
            <input
              type="number"
              min={0}
              max={365}
              className={FIELD_CLASS}
              value={sslDays}
              onChange={(e) => setSslDays(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
            />
          </label>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                patch({
                  checkIntervalSeconds: interval,
                  alertOnStatusChange: onStatus,
                  alertOnContentChange: onContent,
                  alertOnSlowResponse: onSlow,
                  alertOnSslExpiryDays: sslDays,
                }).then(() => setEditing(false))
              }
              className="rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-[#22d3ee]/90 disabled:opacity-50"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <button type="button" disabled={busy} onClick={() => setEditing((v) => !v)} className="hover:text-[#22d3ee]">
          {editing ? "Close" : "Edit"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => patch({ isActive: !site.isActive })}
          className="hover:text-[#22d3ee]"
        >
          {site.isActive ? "Pause" : "Resume"}
        </button>
        <button type="button" disabled={busy} onClick={remove} className="hover:text-rose-300">
          Delete
        </button>
      </div>
    </div>
  )
}

export default function WebsiteMonitorClient({
  websites,
  cap,
  activeCount,
  canAdd,
}: {
  websites: WebsiteView[]
  cap: number | null
  activeCount: number
  canAdd: boolean
}) {
  const router = useRouter()
  const refresh = () => router.refresh()

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-8">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#22d3ee]/60">Always watching</div>
          <h1 className="text-2xl font-bold text-slate-100">Website Monitoring</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Add the URLs that matter — your site, your checkout, a client&apos;s landing page — and PA checks them on a
            schedule. When one goes down, slows to a crawl, changes, or its certificate is about to lapse, the alert is
            waiting in Mission Control.
          </p>
        </div>

        <div className="mb-6">
          <p className="text-xs text-slate-400">
            Watching <span className="text-slate-100">{activeCount}</span> of{" "}
            <span className="text-slate-100">{cap === null ? "unlimited" : cap}</span> websites on your plan.
            {!canAdd && cap !== null && " Pause or delete one to add another, or upgrade for more."}
          </p>
        </div>

        <div className="mb-6">
          <AddWebsite disabled={!canAdd} onAdded={refresh} />
        </div>

        {websites.length > 0 ? (
          <div className="mb-10 flex flex-col gap-3">
            {websites.map((s) => (
              <WebsiteRow key={s.id} site={s} onChanged={refresh} />
            ))}
          </div>
        ) : (
          <p className="mb-10 rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-6 text-center text-sm text-slate-400">
            Nothing watched yet. Add a URL above and PA starts checking it within five minutes.
          </p>
        )}

        <div className="border-t border-slate-800/60 pt-6">
          <p className="text-sm leading-relaxed text-slate-500">
            Every alert stages in{" "}
            <Link href="/app/mission-control" className="text-slate-400 hover:text-[#22d3ee]">
              Mission Control
            </Link>{" "}
            — review it on your tap. Checks run automatically; the sparkline shows recent response times (red dots are
            down checks).
          </p>
        </div>
      </div>
    </div>
  )
}
