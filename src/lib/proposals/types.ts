// Proposal Generator App — shared types + the canonical section list.
//
// A proposal is generated from a Persona (voice) + a brief; the model emits markdown with a fixed set
// of `## ` section headings, which parse.ts turns back into a structured object for the editor + PDF.

import { z } from "zod"

/** The ordered proposal sections. The generator prompts for these headings verbatim; the parser keys off them. */
export const PROPOSAL_SECTIONS = [
  { key: "cover_summary", heading: "Cover Summary" },
  { key: "problems", heading: "Problems We're Solving" },
  { key: "deliverables", heading: "Deliverables" },
  { key: "timeline", heading: "Timeline" },
  { key: "investment", heading: "Investment & Payment Terms" },
  { key: "success_criteria", heading: "Success Criteria" },
  { key: "next_steps", heading: "Next Steps" },
  { key: "signatures", heading: "Signatures" },
] as const

export type ProposalSectionKey = (typeof PROPOSAL_SECTIONS)[number]["key"]

export type ProposalSection = {
  key: ProposalSectionKey | "unknown"
  heading: string
  body: string
}

export type ParsedProposal = {
  sections: ProposalSection[]
  /** Convenience: did every canonical section parse out at least once? */
  complete: boolean
  /** Canonical keys that were missing from the markdown. */
  missing: ProposalSectionKey[]
}

export const PROPOSAL_STATUSES = ["draft", "staged", "sent", "archived"] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

/** The brief the owner submits to generate a proposal. */
export const proposalBriefSchema = z.object({
  personaId: z.string().uuid().nullable().optional(),
  clientName: z.string().trim().min(1).max(200),
  scope: z.string().trim().min(1).max(4000),
  budgetGuidance: z.string().trim().max(1000).optional().default(""),
  tonePreference: z.string().trim().max(400).optional().default(""),
})
export type ProposalBrief = z.infer<typeof proposalBriefSchema>

export type ProposalView = {
  id: string
  personaId: string | null
  clientName: string
  brief: ProposalBrief
  generatedMarkdown: string
  pdfStorageUrl: string | null
  status: ProposalStatus
  createdAt: string
  sentAt: string | null
}
