"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type Status = "draft" | "staged" | "sent" | "archived"

export type ProposalClientView = {
  id: string
  clientName: string
  status: Status
  createdAt: string
  sentAt: string | null
  generatedMarkdown: string
  personaId: string | null
  pdfUrl: string | null
}

type PersonaOption = { id: string; name: string; isSales: boolean }

const FIELD_CLASS =
  "mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none"
const LABEL_CLASS = "text-[11px] font-mono text-slate-400 uppercase tracking-wider"

const STATUS_STYLE: Record<Status, string> = {
  draft: "bg-slate-800 text-slate-300",
  staged: "bg-amber-500/15 text-amber-300",
  sent: "bg-emerald-500/15 text-emerald-300",
  archived: "bg-slate-800 text-slate-500",
}

function NewProposal({
  personas,
  disabled,
  onCreated,
}: {
  personas: PersonaOption[]
  disabled: boolean
  onCreated: () => void
}) {
  const defaultPersona = personas.find((p) => p.isSales)?.id ?? personas[0]?.id ?? ""
  const [open, setOpen] = useState(false)
  const [personaId, setPersonaId] = useState(defaultPersona)
  const [clientName, setClientName] = useState("")
  const [scope, setScope] = useState("")
  const [budget, setBudget] = useState("")
  const [tone, setTone] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch("/api/app/apps/proposals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        personaId: personaId || null,
        clientName: clientName.trim(),
        scope: scope.trim(),
        budgetGuidance: budget.trim(),
        tonePreference: tone.trim(),
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
      setError(data.message ?? data.error ?? "Could not generate the proposal.")
      return
    }
    setClientName("")
    setScope("")
    setBudget("")
    setTone("")
    setOpen(false)
    onCreated()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full rounded-xl border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-300 hover:border-[#22d3ee]/50 hover:text-[#22d3ee] disabled:cursor-not-allowed disabled:opacity-50"
      >
        + New proposal
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      {personas.length > 0 && (
        <label className="block">
          <span className={LABEL_CLASS}>Persona (whose voice)</span>
          <select className={FIELD_CLASS} value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isSales ? " — Sales Assistant" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="mt-4 block">
        <span className={LABEL_CLASS}>Client name</span>
        <input className={FIELD_CLASS} placeholder="Acme Roofing" value={clientName} onChange={(e) => setClientName(e.target.value)} />
      </label>

      <label className="mt-4 block">
        <span className={LABEL_CLASS}>Scope</span>
        <textarea
          className={`${FIELD_CLASS} min-h-[88px]`}
          placeholder="What you're proposing to do — the work, the outcome, anything specific they asked for."
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        />
      </label>

      <label className="mt-4 block">
        <span className={LABEL_CLASS}>Budget guidance (optional)</span>
        <input
          className={FIELD_CLASS}
          placeholder="e.g. ~$8k, monthly retainer, or leave blank for placeholders"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
      </label>

      <label className="mt-4 block">
        <span className={LABEL_CLASS}>Tone preference (optional)</span>
        <input
          className={FIELD_CLASS}
          placeholder="e.g. confident and concise; warm; formal"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
        />
      </label>

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !clientName.trim() || !scope.trim()}
          className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-[#22d3ee]/90 disabled:opacity-50"
        >
          {busy ? "Drafting…" : "Generate draft"}
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

function ProposalRow({ proposal, hasBrain, onChanged }: { proposal: ProposalClientView; hasBrain: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [markdown, setMarkdown] = useState(proposal.generatedMarkdown)
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState<"gmail" | "brain" | null>(null)
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState(`Proposal — ${proposal.clientName}`)
  const [note, setNote] = useState<string | null>(null)

  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    setNote(null)
    const res = await fetch(`/api/app/apps/proposals/${proposal.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setNote(data.error ?? "Save failed.")
      return
    }
    onChanged()
  }

  async function remove() {
    setBusy(true)
    await fetch(`/api/app/apps/proposals/${proposal.id}`, { method: "DELETE" })
    setBusy(false)
    onChanged()
  }

  async function send(mode: "gmail_draft" | "brain") {
    setBusy(true)
    setNote(null)
    const body = mode === "gmail_draft" ? { mode, to: to.trim(), subject: subject.trim() } : { mode }
    const res = await fetch(`/api/app/apps/proposals/${proposal.id}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    setBusy(false)
    setSending(null)
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
      setNote(data.message ?? data.error ?? "Send failed.")
      return
    }
    onChanged()
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] capitalize ${STATUS_STYLE[proposal.status]}`}>
              {proposal.status}
            </span>
            <span className="truncate text-sm font-semibold text-slate-100">{proposal.clientName}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Created {new Date(proposal.createdAt).toLocaleDateString()}
            {proposal.sentAt && ` · sent ${new Date(proposal.sentAt).toLocaleDateString()}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[11px] text-slate-500">
          {proposal.pdfUrl && (
            <a href={proposal.pdfUrl} target="_blank" rel="noreferrer" className="hover:text-[#22d3ee]">
              View PDF
            </a>
          )}
          <button type="button" onClick={() => setOpen((v) => !v)} className="hover:text-[#22d3ee]">
            {open ? "Close" : "Open"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 border-t border-slate-800 pt-4">
          <span className={LABEL_CLASS}>Proposal (edit before sending)</span>
          <textarea
            className={`${FIELD_CLASS} min-h-[320px] font-mono text-[12px] leading-relaxed`}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || markdown === proposal.generatedMarkdown}
              onClick={() => patch({ generatedMarkdown: markdown })}
              className="rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-[#22d3ee]/90 disabled:opacity-50"
            >
              Save edits
            </button>
            {proposal.status === "draft" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => patch({ status: "staged" })}
                className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10"
              >
                Stage for approval
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setSending(sending === "gmail" ? null : "gmail")}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100"
            >
              Send as Gmail draft
            </button>
            <button
              type="button"
              disabled={busy || !hasBrain}
              title={hasBrain ? undefined : "Connect your brain in Settings to file proposals there."}
              onClick={() => send("brain")}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100 disabled:opacity-50"
            >
              File to brain
            </button>
            {proposal.status !== "archived" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => patch({ status: "archived" })}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Archive
              </button>
            )}
            <button type="button" disabled={busy} onClick={remove} className="rounded-lg px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10">
              Delete
            </button>
          </div>

          {sending === "gmail" && (
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <label className="block">
                <span className={LABEL_CLASS}>Recipient email</span>
                <input className={FIELD_CLASS} placeholder="client@example.com" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <label className="mt-3 block">
                <span className={LABEL_CLASS}>Subject</span>
                <input className={FIELD_CLASS} value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
              <p className="mt-2 text-[11px] text-slate-500">
                Creates a draft (PDF attached) in your Gmail Drafts — nothing is sent until you send it yourself.
              </p>
              <button
                type="button"
                disabled={busy || !to.trim() || !subject.trim()}
                onClick={() => send("gmail_draft")}
                className="mt-3 rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-[#22d3ee]/90 disabled:opacity-50"
              >
                {busy ? "Creating draft…" : "Create Gmail draft"}
              </button>
            </div>
          )}

          {note && <p className="mt-3 text-sm text-rose-300">{note}</p>}
        </div>
      )}
    </div>
  )
}

export default function ProposalsClient({
  locked,
  proposals,
  personas,
  hasApiKey,
  hasBrain,
}: {
  locked: boolean
  proposals: ProposalClientView[]
  personas: PersonaOption[]
  hasApiKey: boolean
  hasBrain: boolean
}) {
  const router = useRouter()
  const refresh = () => router.refresh()

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-8">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#22d3ee]/60">Output</div>
          <h1 className="text-2xl font-bold text-slate-100">Proposal Generator</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Pick a Persona, drop in the client and the scope, and PA drafts a full proposal in their voice — cover
            summary, the problems you&apos;re solving, deliverables, timeline, investment, success criteria, next steps,
            signatures. Edit it, then send it as a Gmail draft with the PDF attached or file it to your brain.
          </p>
        </div>

        {locked ? (
          <div className="rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-6">
            <p className="text-sm font-semibold text-slate-100">The Proposal Generator is part of Business Agent and up.</p>
            <p className="mt-2 text-sm text-slate-300">
              Upgrade to draft client proposals from a Persona and your brain.{" "}
              <Link href="/pricing" className="text-[#22d3ee] hover:underline">
                See plans →
              </Link>
            </p>
          </div>
        ) : (
          <>
            {!hasApiKey && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-4">
                <span className="mt-0.5 shrink-0 font-mono text-sm text-[#22d3ee]">→</span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">Add your Anthropic API key to generate proposals.</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Your key, your bill, your data.{" "}
                    <Link href="/app/settings" className="text-[#22d3ee] hover:underline">
                      Go to Settings →
                    </Link>
                  </p>
                </div>
              </div>
            )}

            <div className="mb-6">
              <NewProposal personas={personas} disabled={!hasApiKey} onCreated={refresh} />
            </div>

            {proposals.length > 0 ? (
              <div className="mb-10 flex flex-col gap-3">
                {proposals.map((p) => (
                  <ProposalRow key={p.id} proposal={p} hasBrain={hasBrain} onChanged={refresh} />
                ))}
              </div>
            ) : (
              <p className="mb-10 rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-6 text-center text-sm text-slate-400">
                No proposals yet. Start one above — it drafts in your Persona&apos;s voice from your brain.
              </p>
            )}

            <div className="border-t border-slate-800/60 pt-6">
              <p className="text-sm leading-relaxed text-slate-500">
                Every proposal renders to a PDF on send. The Gmail path leaves a draft (with the PDF attached) in your
                Drafts so you always send the final word yourself.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
