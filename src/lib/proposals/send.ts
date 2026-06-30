// send.ts — deliver a finished proposal. Two paths the owner picks at send time:
//   • gmail_draft — render the PDF, attach it to a Gmail draft in the owner's Drafts (never auto-sent).
//   • brain       — render the PDF, commit it + the markdown to the brain's proposals/ folder.
// Both first render the (possibly edited) markdown to PDF and stage it in Storage so pdf_storage_url is
// always set. The route resolves the Gmail token / brain repo and passes them in; this orchestrates.

import { createGmailDraft } from "@/lib/gmail"
import { commitBrainFiles } from "@/lib/brain/absorb"
import { buildProposalMime } from "./mime"
import { renderProposalPdf } from "./pdf"
import { uploadProposalPdf } from "./storage"
import type { ProposalView } from "./types"

export type SendFailure = { ok: false; status: number; error: string }
export type GmailOutcome = { ok: true; mode: "gmail_draft"; pdfPath: string; draftId: string } | SendFailure
export type BrainOutcome = { ok: true; mode: "brain"; pdfPath: string; brainPaths: string[] } | SendFailure

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "proposal"
  )
}

/** Render + store the PDF. Shared first step for both delivery modes. */
async function renderAndStore(
  ownerId: string,
  proposal: ProposalView,
): Promise<{ ok: true; bytes: Buffer; path: string } | { ok: false; status: number; error: string }> {
  const rendered = await renderProposalPdf(proposal.generatedMarkdown)
  if (!rendered.ok) return { ok: false, status: 502, error: `PDF render failed: ${rendered.error}` }
  const stored = await uploadProposalPdf({ ownerId, proposalId: proposal.id, bytes: rendered.bytes })
  if (!stored.ok) return { ok: false, status: 502, error: stored.error }
  return { ok: true, bytes: rendered.bytes, path: stored.path }
}

export async function deliverViaGmailDraft(params: {
  ownerId: string
  proposal: ProposalView
  to: string
  subject: string
  accessToken: string
  fromEmail: string | null
}): Promise<GmailOutcome> {
  const staged = await renderAndStore(params.ownerId, params.proposal)
  if (!staged.ok) return staged

  const filename = `Proposal-${slugify(params.proposal.clientName)}.pdf`
  const bodyText =
    `Hi,\n\nPlease find the proposal for ${params.proposal.clientName} attached.\n\n` +
    `Happy to walk through any of it.\n`

  const raw = buildProposalMime({
    to: params.to,
    fromEmail: params.fromEmail,
    subject: params.subject,
    bodyText,
    pdfBytes: staged.bytes,
    pdfFilename: filename,
  })

  const draft = await createGmailDraft(params.accessToken, { raw })
  if (!draft.ok) return { ok: false, status: draft.status, error: draft.error }
  return { ok: true, mode: "gmail_draft", pdfPath: staged.path, draftId: draft.data.id }
}

export async function deliverToBrain(params: {
  ownerId: string
  proposal: ProposalView
  brainRepo: string
  githubToken: string
}): Promise<BrainOutcome> {
  const staged = await renderAndStore(params.ownerId, params.proposal)
  if (!staged.ok) return staged

  const slug = slugify(params.proposal.clientName)
  const date = new Date().toISOString().slice(0, 10)
  const base = `proposals/${date}-${slug}-${params.proposal.id.slice(0, 8)}`
  const mdPath = `${base}.md`
  const pdfPath = `${base}.pdf`

  const files = new Map<string, { content: string; encoding: "utf-8" | "base64" }>([
    [mdPath, { content: params.proposal.generatedMarkdown, encoding: "utf-8" }],
    [pdfPath, { content: staged.bytes.toString("base64"), encoding: "base64" }],
  ])

  const committed = await commitBrainFiles({
    repo: params.brainRepo,
    token: params.githubToken,
    files,
    commitMessage: `Proposal for ${params.proposal.clientName} (${date})`,
  })
  if (!committed.ok) return { ok: false, status: 502, error: committed.error }
  return { ok: true, mode: "brain", pdfPath: staged.path, brainPaths: [mdPath, pdfPath] }
}
