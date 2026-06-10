import { describe, it, expect } from "vitest";
import { parseSkill, serializeSkill } from "../format";
import type { Skill } from "../types";

function sampleSkill(): Skill {
  return {
    frontmatter: {
      name: "Draft Roof Supplement Quote",
      slug: "draft-roof-supplement-quote",
      description: "Turn inspection photos + a storm date into an approved supplement quote.",
      whenToUse: "A post-storm insurance supplement with photos + a damage date. Not retail quotes.",
      prerequisites: ["Inspection photos in the job folder", "An approximate storm date"],
      zone: "project-shared",
      examples: [
        {
          runId: "run-a1b2c3",
          date: "2026-06-08",
          input: "Williams, 14 photos",
          output: "9 line items, PDF, cover email",
          outcome: "approved",
        },
      ],
      evolution: {
        createdAt: "2026-06-08",
        lastEvolvedAt: "2026-06-09",
        evolvedFromRuns: ["run-a1b2c3", "run-d4e5f6"],
        successCount: 9,
        ownerApprovalsCount: 4,
        version: 4,
        autoEvolve: false,
      },
    },
    body: "# Draft Roof Supplement Quote\n\n1. Read the photos for scope.\n2. Pull the storm date.",
  };
}

describe("serializeSkill / parseSkill", () => {
  it("round-trips a full Skill losslessly", () => {
    const skill = sampleSkill();
    const parsed = parseSkill(serializeSkill(skill));
    expect(parsed).not.toBeNull();
    expect(parsed!.frontmatter).toEqual(skill.frontmatter);
    expect(parsed!.body).toBe(skill.body.trim());
  });

  it("preserves quotes and special characters in the body and scalars", () => {
    const skill = sampleSkill();
    skill.frontmatter.description = 'Use "elevation" labels — front/back/left/right.';
    skill.body = 'Say: "no I-hope-this-finds-you-well". Use a single CTA.';
    const parsed = parseSkill(serializeSkill(skill));
    expect(parsed!.frontmatter.description).toBe('Use "elevation" labels — front/back/left/right.');
    expect(parsed!.body).toContain('"no I-hope-this-finds-you-well"');
  });

  it("returns null for content with no frontmatter fence", () => {
    expect(parseSkill("# Just a heading\n\nbody")).toBeNull();
    expect(parseSkill("")).toBeNull();
  });

  it("falls back to defaults for missing/garbled fields (soft parse)", () => {
    const md = ['---', 'name: "Tiny Skill"', 'slug: "tiny"', 'version: not-a-number', '---', '', 'do the thing'].join("\n");
    const parsed = parseSkill(md);
    expect(parsed).not.toBeNull();
    expect(parsed!.frontmatter.name).toBe("Tiny Skill");
    expect(parsed!.frontmatter.zone).toBe("project-shared"); // schema default
    expect(parsed!.frontmatter.evolution.version).toBe(1); // garbled number → default
    expect(parsed!.body).toBe("do the thing");
  });

  it("collapses multi-line description/when_to_use to a single line on emit", () => {
    const skill = sampleSkill();
    skill.frontmatter.description = "line one\n  line two";
    const parsed = parseSkill(serializeSkill(skill));
    expect(parsed!.frontmatter.description).toBe("line one line two");
  });

  // ── agentskills.io interop (PA-SKILL-INTEROP-1..3) ──────────────────────────────────────
  it("emits the agentskills.io-compatible frontmatter shape", () => {
    const md = serializeSkill(sampleSkill());
    // Required by the standard: `name` is the lowercase-hyphen identifier (== slug == directory),
    // and `description` is non-empty.
    expect(md).toContain('name: "draft-roof-supplement-quote"');
    expect(md).toContain('description: "Turn inspection photos');
    // The human title moves to `title`; `slug` is kept for backward compatibility.
    expect(md).toContain('title: "Draft Roof Supplement Quote"');
    expect(md).toContain('slug: "draft-roof-supplement-quote"');
    // Optional standard fields + the interop marker.
    expect(md).toContain('license: "Proprietary"');
    expect(md).toContain("agentskills_io_compatible: true");
    expect(md).toContain("metadata:");
    expect(md).toContain('source: "Pocket Agent"');
    expect(md).toContain('pa_version: "4"');
  });

  it("reads a minimal hand-written agentskills.io SKILL.md (name=identifier, title=human)", () => {
    const md = [
      "---",
      "name: pdf-processing",
      "title: PDF Processing",
      'description: "Extract text from PDFs. Use when handling PDFs."',
      "---",
      "",
      "Do the extraction.",
    ].join("\n");
    const parsed = parseSkill(md);
    expect(parsed).not.toBeNull();
    expect(parsed!.frontmatter.name).toBe("PDF Processing"); // human display ← title
    expect(parsed!.frontmatter.slug).toBe("pdf-processing"); // identifier ← name
    expect(parsed!.body).toBe("Do the extraction.");
  });
});
