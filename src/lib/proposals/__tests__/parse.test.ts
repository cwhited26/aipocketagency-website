import { describe, it, expect } from "vitest"
import { matchSectionKey, parseProposalSections } from "../parse"
import { PROPOSAL_SECTIONS } from "../types"

const FULL = `# Proposal for Acme Roofing

## Cover Summary
A short summary.

## Problems We're Solving
- Slow quotes
- Lost leads

## Deliverables
- A new site
- A CRM

## Timeline
Phase 1 — discovery.

## Investment & Payment Terms
$8,000. 50% deposit.

## Success Criteria
- 20% more booked jobs

## Next Steps
Sign below.

## Signatures
[YOUR NAME] ____  Acme ____
`

describe("matchSectionKey", () => {
  it("maps exact canonical headings", () => {
    expect(matchSectionKey("Cover Summary")).toBe("cover_summary")
    expect(matchSectionKey("Investment & Payment Terms")).toBe("investment")
    expect(matchSectionKey("Signatures")).toBe("signatures")
  })

  it("maps lightly-renamed headings via normalization + substring", () => {
    expect(matchSectionKey("Investment and Payment Terms")).toBe("investment")
    expect(matchSectionKey("Problems we are solving")).toBe("problems")
    expect(matchSectionKey("Next Step")).toBe("next_steps")
  })

  it("returns unknown for an unrelated heading", () => {
    expect(matchSectionKey("Appendix A: References")).toBe("unknown")
  })
})

describe("parseProposalSections", () => {
  it("parses every canonical section and reports complete", () => {
    const parsed = parseProposalSections(FULL)
    expect(parsed.complete).toBe(true)
    expect(parsed.missing).toHaveLength(0)
    expect(parsed.sections).toHaveLength(PROPOSAL_SECTIONS.length)
    const keys = parsed.sections.map((s) => s.key)
    expect(keys).toEqual([
      "cover_summary",
      "problems",
      "deliverables",
      "timeline",
      "investment",
      "success_criteria",
      "next_steps",
      "signatures",
    ])
  })

  it("captures section bodies, ignoring the H1 title", () => {
    const parsed = parseProposalSections(FULL)
    const cover = parsed.sections.find((s) => s.key === "cover_summary")
    expect(cover?.body).toBe("A short summary.")
    const deliverables = parsed.sections.find((s) => s.key === "deliverables")
    expect(deliverables?.body).toContain("- A new site")
    expect(deliverables?.body).toContain("- A CRM")
  })

  it("reports missing sections when the model drops some", () => {
    const partial = `# Proposal\n\n## Cover Summary\nHi.\n\n## Deliverables\n- thing\n`
    const parsed = parseProposalSections(partial)
    expect(parsed.complete).toBe(false)
    expect(parsed.missing).toContain("investment")
    expect(parsed.missing).toContain("signatures")
    expect(parsed.missing).not.toContain("cover_summary")
  })

  it("keeps an unrecognised section instead of dropping its content", () => {
    const withExtra = `## Cover Summary\nHi.\n\n## Appendix\nExtra notes here.\n`
    const parsed = parseProposalSections(withExtra)
    const unknown = parsed.sections.find((s) => s.key === "unknown")
    expect(unknown?.heading).toBe("Appendix")
    expect(unknown?.body).toBe("Extra notes here.")
  })

  it("does not treat a '## ' inside prose-less input as missing the title", () => {
    const noTitle = `## Cover Summary\nBody.\n`
    const parsed = parseProposalSections(noTitle)
    expect(parsed.sections[0].key).toBe("cover_summary")
    expect(parsed.sections[0].body).toBe("Body.")
  })
})
