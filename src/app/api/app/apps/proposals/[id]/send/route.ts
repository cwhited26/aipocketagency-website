// /api/app/apps/proposals/[id]/send — deliver a proposal. The owner picks the mode:
//   • gmail_draft — render the PDF, attach it to a Gmail draft (requires Gmail connected + a recipient).
//   • brain       — render the PDF + commit it with the markdown to the brain's proposals/ folder.
// On success the proposal is stamped sent (pdf_storage_url + sent_at).

import { createClient } from "@/lib/supabase/server"
import { fetchPaUser } from "@/lib/pa-supabase"
import { resolveGmailAccess } from "@/lib/connectors/gmail/read"
import { getProposal, updateProposal } from "@/lib/proposals/db"
import { deliverToBrain, deliverViaGmailDraft } from "@/lib/proposals/send"
import { NextResponse } from "next/server"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

const bodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("gmail_draft"),
    to: z.string().email(),
    subject: z.string().trim().min(1).max(300),
  }),
  z.object({ mode: z.literal("brain") }),
])

export async function POST(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 422 })
  }

  const existing = await getProposal(user.id, params.id)
  if (!existing.ok) return NextResponse.json({ error: existing.error }, { status: existing.status })
  if (!existing.data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const proposal = existing.data
  if (proposal.status === "archived") {
    return NextResponse.json({ error: "Cannot send an archived proposal." }, { status: 409 })
  }

  if (parsed.data.mode === "gmail_draft") {
    const access = await resolveGmailAccess(user.id)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const outcome = await deliverViaGmailDraft({
      ownerId: user.id,
      proposal,
      to: parsed.data.to,
      subject: parsed.data.subject,
      accessToken: access.token,
      fromEmail: access.email,
    })
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status })
    await updateProposal(user.id, proposal.id, {
      status: "sent",
      pdfStorageUrl: outcome.pdfPath,
      sentAt: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true, mode: outcome.mode, draftId: outcome.draftId })
  }

  // mode === "brain"
  const paResult = await fetchPaUser(user.id)
  const paUser = paResult.ok ? paResult.data : null
  if (!paUser?.brain_repo || !paUser.github_token) {
    return NextResponse.json(
      { error: "no_brain", message: "Connect your brain in Settings to file proposals there." },
      { status: 409 },
    )
  }
  const outcome = await deliverToBrain({
    ownerId: user.id,
    proposal,
    brainRepo: paUser.brain_repo,
    githubToken: paUser.github_token,
  })
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status })
  await updateProposal(user.id, proposal.id, {
    status: "sent",
    pdfStorageUrl: outcome.pdfPath,
    sentAt: new Date().toISOString(),
  })
  return NextResponse.json({ ok: true, mode: outcome.mode, brainPaths: outcome.brainPaths })
}
