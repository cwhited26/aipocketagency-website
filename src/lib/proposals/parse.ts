// parse.ts — the structured-output parser (pure, unit-tested in isolation).
//
// The generator emits markdown with `## ` headings; this turns that back into the canonical section
// list so the editor can show each section and the PDF renderer can lay them out. A heading the model
// renamed slightly still maps to its canonical key via a normalized match; anything unrecognised is
// kept as an "unknown" section (never dropped) so no generated content is silently lost.

import { PROPOSAL_SECTIONS, type ParsedProposal, type ProposalSection, type ProposalSectionKey } from "./types"

/** Lowercase, strip punctuation + leading "we're/we are", collapse whitespace — for fuzzy heading matching. */
function normalizeHeading(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const CANONICAL_BY_NORMALIZED = new Map<string, ProposalSectionKey>(
  PROPOSAL_SECTIONS.map((s) => [normalizeHeading(s.heading), s.key]),
)

// Keyword matchers for headings the model renames slightly. Checked in this order, so the more
// specific keys win over broad ones (e.g. "investment" before a stray "cost"). Each value is a list
// of normalized substrings; a heading matches the first key whose list it contains one of.
const SECTION_KEYWORDS: Array<[ProposalSectionKey, string[]]> = [
  ["cover_summary", ["cover summary", "summary", "overview", "introduction"]],
  ["problems", ["problem", "challenge", "pain"]],
  ["deliverables", ["deliverable", "scope of work", "what you get", "what s included", "whats included"]],
  ["timeline", ["timeline", "schedule", "phases", "milestone"]],
  ["investment", ["investment", "payment", "pricing", "price", "cost", "fees"]],
  ["success_criteria", ["success", "outcome", "kpi", "metric"]],
  ["next_steps", ["next step", "getting started", "how to proceed"]],
  ["signatures", ["signature", "sign off", "acceptance", "agreement"]],
]

/** Map a raw heading to a canonical key, or "unknown" when it doesn't match one of the eight. */
export function matchSectionKey(rawHeading: string): ProposalSectionKey | "unknown" {
  const norm = normalizeHeading(rawHeading)
  const exact = CANONICAL_BY_NORMALIZED.get(norm)
  if (exact) return exact
  for (const [key, keywords] of SECTION_KEYWORDS) {
    if (keywords.some((kw) => norm.includes(kw))) return key
  }
  return "unknown"
}

/**
 * Parse proposal markdown into its sections. Headings are `##`-level (a leading `#` title line is
 * ignored as the document title). Pure + deterministic.
 */
export function parseProposalSections(markdown: string): ParsedProposal {
  const lines = markdown.split("\n")
  const sections: ProposalSection[] = []
  let current: { heading: string; bodyLines: string[] } | null = null

  for (const line of lines) {
    const h2 = line.match(/^\s{0,3}##\s+(.+?)\s*#*\s*$/)
    const h1 = line.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/)
    if (h2) {
      if (current) sections.push(finalize(current))
      current = { heading: h2[1].trim(), bodyLines: [] }
    } else if (h1 && !current) {
      // A leading H1 is the document title — skip it until the first H2 opens a section.
      continue
    } else if (current) {
      current.bodyLines.push(line)
    }
  }
  if (current) sections.push(finalize(current))

  const seen = new Set(sections.map((s) => s.key))
  const missing = PROPOSAL_SECTIONS.map((s) => s.key).filter((k) => !seen.has(k))

  return { sections, complete: missing.length === 0, missing }
}

function finalize(current: { heading: string; bodyLines: string[] }): ProposalSection {
  return {
    key: matchSectionKey(current.heading),
    heading: current.heading,
    body: current.bodyLines.join("\n").trim(),
  }
}
