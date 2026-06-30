// generate.ts — draft a structured proposal from a Persona's voice + the owner's brain + a brief.
//
// Built on the Email Drafter / Quote Writer pattern (lib/pa-drafts.ts): the same brain-memory voice
// loader, the same direct-REST Anthropic call (no SDK), the same citation discipline. The only
// additions are the chosen Persona's voice framing and the fixed eight-section proposal structure that
// parse.ts reads back.

import { buildMemoryBlocks, type MemoryBlock } from "@/lib/pa-brain"
import { logCostFromUsage, type CostContext } from "@/lib/cost/log"
import { PROPOSAL_SECTIONS, type ProposalBrief } from "./types"

const PROPOSAL_MODEL = "claude-sonnet-4-6"

/** The chosen Persona's voice inputs (resolved from the persona row in the route). */
export type PersonaVoice = {
  name: string
  role: string
  /** TONE_GUIDANCE[persona.tone] — the same tone text the Persona chat uses. */
  toneGuidance: string
}

function formatBlocks(blocks: MemoryBlock[]): string {
  return blocks
    .map(({ path, content }) => {
      const numbered = content
        .split("\n")
        .map((l, i) => `${i + 1}: ${l}`)
        .join("\n")
      return `--- ${path} ---\n${numbered}`
    })
    .join("\n\n")
}

function sectionList(): string {
  return PROPOSAL_SECTIONS.map((s, i) => `${i + 1}. ## ${s.heading}`).join("\n")
}

function buildProposalSystemPrompt(
  memoryBlocks: MemoryBlock[],
  persona: PersonaVoice | null,
  brief: ProposalBrief,
): string {
  const hasMemory = memoryBlocks.length > 0
  const memorySection = hasMemory
    ? `BRAIN MEMORY FILES (the operator's business context — services, pricing, positioning, voice, past work):\n${formatBlocks(
        memoryBlocks,
      )}\n\n`
    : `NOTE: No brain memory files are connected yet. Draft the strongest proposal you can from the brief. Where pricing, services, or terms aren't known, write clear placeholders like "[YOUR STANDARD RATE]" — never invent numbers — and at the very end list 2-3 things the operator should add to their brain to sharpen future proposals.\n\n`

  const personaSection = persona
    ? `YOU ARE WRITING AS: "${persona.name}" — ${persona.role}. Adopt this assistant's voice and judgment throughout.\nVOICE: ${persona.toneGuidance}\n\n`
    : `YOU ARE WRITING AS: the operator's sales assistant. Direct, specific, confident — never corporate filler.\n\n`

  return `You are drafting a client proposal on behalf of an independent operator. It must read like a sharp, human proposal the operator would send — not a bloated template, not ChatGPT boilerplate.

${personaSection}${memorySection}THE BRIEF:
CLIENT: ${brief.clientName}
SCOPE: ${brief.scope}${brief.budgetGuidance ? `\nBUDGET GUIDANCE: ${brief.budgetGuidance}` : ""}${
    brief.tonePreference ? `\nTONE PREFERENCE: ${brief.tonePreference}` : ""
  }

OUTPUT FORMAT (markdown, exactly this structure — nothing before the title, nothing after the last section):
A single H1 title line: "# Proposal for ${brief.clientName}".
Then these eight H2 sections, in this order, with these exact headings:
${sectionList()}

WHAT EACH SECTION COVERS:
- Cover Summary: 2-3 sentences. Who this is for and the outcome it delivers. No throat-clearing.
- Problems We're Solving: the specific problems this engagement addresses, in the client's terms. Bullets.
- Deliverables: concrete line items of what the client receives. Specific, derived from the scope.
- Timeline: phased or milestone timeline. If no dates were given, use relative phases ("Phase 1 — …") with a "[START DATE]" placeholder rather than inventing dates.
- Investment & Payment Terms: pricing + payment schedule. Use brain pricing if present; otherwise "[PRICE — add your standard rate]" placeholders. Never invent numbers. Include a payment schedule (e.g. deposit / milestones / on completion).
- Success Criteria: how both sides will know this worked. Measurable where possible.
- Next Steps: one short paragraph + a single clear action to move forward.
- Signatures: a signature block for both parties — operator name + client name + date lines. Use the operator's name/business from the brain if present, otherwise "[YOUR NAME]".

VOICE RULES:
- Write the way the operator (and the Persona above) would. Short sentences, specific language, no "leverage", no "synergy", no "I hope this finds you well".
- Every factual claim pulled from memory must be cited inline: [memory/filename.md:line].
- Specific > vague. Use real services, pricing, and positioning from the brain when present.
- Do not invent prices, dates, or client facts. Use the bracketed placeholders instead and keep them obvious.`
}

type AnthropicTextBlock = { type: "text"; text: string }
type AnthropicApiResponse = {
  content: AnthropicTextBlock[]
  usage?: { input_tokens?: number; output_tokens?: number }
}

export async function generateProposal(
  params: { persona: PersonaVoice | null; brief: ProposalBrief },
  anthropicApiKey: string,
  brainRepo: string | null,
  githubToken: string | null,
  cost?: CostContext,
): Promise<{ markdown: string; hasBrain: boolean }> {
  const memoryBlocks: MemoryBlock[] = brainRepo ? await buildMemoryBlocks(brainRepo, githubToken) : []

  const systemPrompt = buildProposalSystemPrompt(memoryBlocks, params.persona, params.brief)

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: PROPOSAL_MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Write the proposal now. Start directly with the H1 title line, then the eight H2 sections in order. No preamble.",
        },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic error: ${await res.text()}`)
  }

  const msg = (await res.json()) as AnthropicApiResponse
  if (cost) {
    await logCostFromUsage(cost, "anthropic", PROPOSAL_MODEL, {
      tokensInput: msg.usage?.input_tokens ?? 0,
      tokensOutput: msg.usage?.output_tokens ?? 0,
    })
  }
  const markdown = msg.content.find((c) => c.type === "text")?.text ?? ""
  return { markdown, hasBrain: memoryBlocks.length > 0 }
}
