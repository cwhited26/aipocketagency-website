// /api/app/apps/proposals — list the owner's proposals (GET) and generate a new one (POST).
// Generation is a Business Agent+ feature; it loads the chosen Persona's voice + the brain, drafts the
// structured proposal, and stores it as a draft the owner can edit before sending.

import { createClient } from "@/lib/supabase/server"
import { fetchPaUser } from "@/lib/pa-supabase"
import { fetchPersona, listPersonasForBusiness } from "@/lib/personas/db"
import { TONE_GUIDANCE } from "@/lib/personas/types"
import { getCurrentTier, tierAllowsProposalGenerator } from "@/lib/personas/tier-caps"
import { generateProposal, type PersonaVoice } from "@/lib/proposals/generate"
import { createProposal, listProposals } from "@/lib/proposals/db"
import { proposalBriefSchema } from "@/lib/proposals/types"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(): Promise<NextResponse> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await listProposals(user.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ proposals: result.data })
}

/** Resolve the Persona voice: the chosen persona (owner-checked), else the owner's Sales Assistant. */
async function resolvePersonaVoice(
  userId: string,
  personaId: string | null | undefined,
): Promise<{ id: string | null; voice: PersonaVoice | null }> {
  if (personaId) {
    const persona = await fetchPersona(personaId)
    if (persona && persona.business_id === userId) {
      return {
        id: persona.id,
        voice: { name: persona.name, role: persona.name, toneGuidance: TONE_GUIDANCE[persona.tone] },
      }
    }
    return { id: null, voice: null }
  }
  const personas = await listPersonasForBusiness(userId)
  const sales = personas.find((p) => p.template_key === "sales") ?? personas[0]
  if (sales) {
    return { id: sales.id, voice: { name: sales.name, role: sales.name, toneGuidance: TONE_GUIDANCE[sales.tone] } }
  }
  return { id: null, voice: null }
}

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const tier = await getCurrentTier(user.id)
  if (!tierAllowsProposalGenerator(tier)) {
    return NextResponse.json(
      {
        error: "tier_locked",
        message: "The Proposal Generator is part of Business Agent and up. Upgrade to draft client proposals.",
      },
      { status: 403 },
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = proposalBriefSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 422 })
  }

  const paResult = await fetchPaUser(user.id)
  if (!paResult.ok) return NextResponse.json({ error: "User record not found" }, { status: 404 })
  const paUser = paResult.data
  if (!paUser?.anthropic_api_key) {
    return NextResponse.json(
      { error: "no_api_key", message: "Add your Anthropic API key in Settings to generate proposals." },
      { status: 402 },
    )
  }

  const persona = await resolvePersonaVoice(user.id, parsed.data.personaId)

  let generated: { markdown: string; hasBrain: boolean }
  try {
    generated = await generateProposal(
      { persona: persona.voice, brief: parsed.data },
      paUser.anthropic_api_key,
      paUser.brain_repo,
      paUser.github_token,
      {
        ownerId: user.id,
        featureSlug: "proposal_generator",
        idempotencyKey: `proposal_gen:${user.id}:${Date.now()}`,
      },
    )
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed" }, { status: 502 })
  }

  const created = await createProposal({
    ownerId: user.id,
    personaId: persona.id,
    clientName: parsed.data.clientName,
    brief: parsed.data,
    generatedMarkdown: generated.markdown,
  })
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status })
  return NextResponse.json({ proposal: created.data, hasBrain: generated.hasBrain }, { status: 201 })
}
