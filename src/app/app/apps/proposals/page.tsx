import { createClient } from "@/lib/supabase/server"
import { fetchPaUser } from "@/lib/pa-supabase"
import { listPersonasForBusiness } from "@/lib/personas/db"
import { getPersonaDisplayName } from "@/lib/personas/types"
import { getCurrentTier, tierAllowsProposalGenerator } from "@/lib/personas/tier-caps"
import { listProposals } from "@/lib/proposals/db"
import { signProposalPdf } from "@/lib/proposals/storage"
import { redirect } from "next/navigation"
import ProposalsClient, { type ProposalClientView } from "./ProposalsClient"

export const dynamic = "force-dynamic"

export default async function ProposalsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/app/login")

  const result = await fetchPaUser(user.id)
  const paUser = result.ok ? result.data : null
  if (!paUser) redirect("/app/onboarding")

  const tier = await getCurrentTier(user.id)
  const locked = !tierAllowsProposalGenerator(tier)

  const [proposalsResult, personas] = await Promise.all([
    locked ? Promise.resolve({ ok: true as const, data: [] }) : listProposals(user.id),
    locked ? Promise.resolve([]) : listPersonasForBusiness(user.id),
  ])

  const proposals = proposalsResult.ok ? proposalsResult.data : []

  // Mint a short-lived signed URL for each sent proposal's PDF so the owner can open it from the surface.
  const views: ProposalClientView[] = await Promise.all(
    proposals.map(async (p) => {
      let pdfUrl: string | null = null
      if (p.pdfStorageUrl) {
        const signed = await signProposalPdf(p.pdfStorageUrl)
        if (signed.ok) pdfUrl = signed.url
      }
      return {
        id: p.id,
        clientName: p.clientName,
        status: p.status,
        createdAt: p.createdAt,
        sentAt: p.sentAt,
        generatedMarkdown: p.generatedMarkdown,
        personaId: p.personaId,
        pdfUrl,
      }
    }),
  )

  return (
    <ProposalsClient
      locked={locked}
      proposals={views}
      personas={personas.map((p) => ({ id: p.id, name: getPersonaDisplayName(p), isSales: p.template_key === "sales" }))}
      hasApiKey={Boolean(paUser.anthropic_api_key)}
      hasBrain={Boolean(paUser.brain_repo && paUser.github_token)}
    />
  )
}
