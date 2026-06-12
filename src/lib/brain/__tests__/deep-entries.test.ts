import { describe, it, expect } from "vitest";
import {
  classifyDeepPath,
  isDecisionLogPath,
  isSpecDocPath,
  isOpenQuestionsPath,
  isChangeLogPath,
  extractDecisionEntries,
  extractOpenQuestionEntries,
  extractChangeLogEntries,
  extractSpecEntry,
  extractDeepEntries,
} from "@/lib/brain/deep-entries";

describe("deep path classification", () => {
  it("matches decision logs in every real naming style", () => {
    expect(isDecisionLogPath("BOS/BOS_Decision_Log.md")).toBe(true);
    expect(isDecisionLogPath("APA/Decision_Log.md")).toBe(true);
    expect(isDecisionLogPath("PA_seeds/patrick-brain/decision-log.md")).toBe(true);
    expect(isDecisionLogPath("BOS/HanesEnvironmental/Decision_Log.md")).toBe(true);
    expect(isDecisionLogPath("shared/Decision_Log.md")).toBe(true);
  });

  it("matches spec docs only when 'spec' is a delimited token", () => {
    expect(isSpecDocPath("APA/Products/Pocket_Agent_Skills_SPEC_v1.md")).toBe(true);
    expect(isSpecDocPath("BOS/HanesEnvironmental/Restoration_CRM_Spec_v1.md")).toBe(true);
    expect(isSpecDocPath("voice/chase-spec.md")).toBe(true);
    expect(isSpecDocPath("BOS/Sites/Master_Plan.md")).toBe(true);
    expect(isSpecDocPath("APA/Roadmap.md")).toBe(true);
    // "inspection" and "prospect" contain the letters but not the token.
    expect(isSpecDocPath("memory/reference_riptideai-roof-inspection-website.md")).toBe(false);
    expect(isSpecDocPath("BOS/roof-inspection-checklist.md")).toBe(false);
  });

  it("keeps memory/ and hidden paths with the existing walker", () => {
    expect(classifyDeepPath("memory/project_pa_funnel_v1_20260609.md")).toBeNull();
    expect(classifyDeepPath(".proposed/Decision_Log.md")).toBeNull();
  });

  it("classifies open questions and change logs", () => {
    expect(isOpenQuestionsPath("BOS/HanesEnvironmental/Open_Questions.md")).toBe(true);
    expect(isChangeLogPath("APA/Change_Log.md")).toBe(true);
    expect(isChangeLogPath("BOS/BOS_Change_Log.md")).toBe(true);
  });

  it("a decision log named *_Change_Log is a change log, decision wins only on its own pattern", () => {
    expect(classifyDeepPath("WC/Decision_Log.md")).toBe("decision");
    expect(classifyDeepPath("WC/Change_Log.md")).toBe("change_log_entry");
  });
});

describe("extractDecisionEntries", () => {
  it("parses '## Decision <id> — date — Title' headings", () => {
    const content = [
      "# APA Decision Log",
      "",
      "## Decision APA-44 — 2026-06-08 — Setup status bar persists until dismissed",
      "",
      "The setup bar stays until the user finishes or dismisses it.",
      "",
      "## Decision PA-COST-1..8 — 2026-06-08 — Cost Observability + Budgets",
      "",
      "Every metered dollar is accounted for to the cent.",
    ].join("\n");
    const entries = extractDecisionEntries("APA/Decision_Log.md", content);
    expect(entries).toHaveLength(2);
    expect(entries[0].ref).toBe("APA-44");
    expect(entries[0].name).toBe("Setup status bar persists until dismissed");
    expect(entries[0].date).toBe("2026-06-08");
    expect(entries[0].path).toBe("APA/Decision_Log.md#decision-apa-44");
    expect(entries[1].ref).toBe("PA-COST-1..8");
    expect(entries[1].description).toContain("metered dollar");
  });

  it("parses bold '**Decision #N** — date — **Title**' blocks", () => {
    const content = [
      "# BOS Decision Log",
      "",
      "---",
      "**Decision #206** — 2026-06-11 — **BOS Sites productized as a 3-tier offering**",
      "Status: **Productized offering**",
      "Decision: BOS Sites is the productized 3-tier offering at $750 / $1,750 / $2,500.",
      "",
      "---",
      "**Decision #205** — 2026-06-11 — **BOS Care managed-hosting add-on**",
      "Body of 205.",
    ].join("\n");
    const entries = extractDecisionEntries("BOS/BOS_Decision_Log.md", content);
    expect(entries).toHaveLength(2);
    expect(entries[0].ref).toBe("206");
    expect(entries[0].name).toBe("BOS Sites productized as a 3-tier offering");
    expect(entries[1].ref).toBe("205");
  });

  it("keeps per-session and global numbering as separate decisions", () => {
    const content = [
      "### Decision 7 from Session 1 — April 4, 2026 — Template Extraction",
      "Old-format body.",
      "",
      "**Decision #7** - 2026-04-20",
      "**Title:** A different, newer decision seven",
      "Newer body.",
    ].join("\n");
    const entries = extractDecisionEntries("BOS/BOS_Decision_Log.md", content);
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe("Template Extraction");
    expect(entries[1].name).toBe("A different, newer decision seven");
    // Anchor collision resolved with an ordinal suffix — paths stay unique.
    expect(new Set(entries.map((e) => e.path)).size).toBe(2);
  });

  it("parses coded headings (HE-7, D-002 ·) and plain Title: lines", () => {
    const content = [
      "## HE-7 — 2026-06-10 — MVP scope: presentable, not plugged in (Chase)",
      "",
      "**Decision:** The mockup is a presentable preview, not a working backend.",
      "",
      "## D-002 · 2026-06-02 — Surname spelling confirmed",
      "",
      "**Decision:** Stoll is correct.",
    ].join("\n");
    const entries = extractDecisionEntries("BOS/HanesEnvironmental/Decision_Log.md", content);
    expect(entries).toHaveLength(2);
    expect(entries[0].ref).toBe("HE-7");
    expect(entries[0].name).toContain("MVP scope");
    expect(entries[0].description).toContain("presentable preview");
    expect(entries[1].ref).toBe("D-002");
  });

  it("ignores section headings and document titles", () => {
    const content = [
      "# BOS Decision Log",
      "## Buildout Studio — Complete Decision Record",
      "## Business & Product Decisions",
      "",
      "## Decision 12 — 2026-04-04 — Seed Data Enrichment",
      "Body.",
    ].join("\n");
    const entries = extractDecisionEntries("BOS/BOS_Decision_Log.md", content);
    expect(entries).toHaveLength(1);
    expect(entries[0].ref).toBe("12");
  });

  it("does not treat '**Decision:**' body labels as new entries", () => {
    const content = [
      "## Decision WC-1 — 2026-05-09 — Parent-brand domain",
      "",
      "**Decision:** The parent agency owns whited.consulting.",
      "**Rationale:** Routing surface.",
    ].join("\n");
    const entries = extractDecisionEntries("WC/Decision_Log.md", content);
    expect(entries).toHaveLength(1);
    expect(entries[0].description).toContain("whited.consulting");
  });
});

describe("extractOpenQuestionEntries", () => {
  it("parses heading-per-question files", () => {
    const content = [
      "# Open Questions — Hanes Environmental Build",
      "",
      "Each blocks something specific.",
      "",
      "## HE-Q-1 — AI Pocket Agent integration: native or embedded SaaS?",
      "",
      "**Blocks:** §8 of the spec.",
      "",
      "## HE-Q-2 — Paper the revenue-share handshake",
      "",
      "**Blocks:** Selling the assessor CRM.",
    ].join("\n");
    const entries = extractOpenQuestionEntries("BOS/HanesEnvironmental/Open_Questions.md", content);
    expect(entries).toHaveLength(2);
    expect(entries[0].ref).toBe("HE-Q-1");
    expect(entries[0].type).toBe("open_question");
    expect(entries[0].path).toContain("#oq-");
  });

  it("falls back to top-level bullets when there are no headings", () => {
    const content = [
      "# Open Questions",
      "",
      "- Should the pilot credit toward the subscription?",
      "- Which screen recorder for the demo content?",
    ].join("\n");
    const entries = extractOpenQuestionEntries("APA/Open_Questions.md", content);
    expect(entries).toHaveLength(2);
    expect(entries[1].name).toContain("screen recorder");
  });
});

describe("extractChangeLogEntries", () => {
  it("parses dated headings and keeps sub-headings in the body", () => {
    const content = [
      "# AI Pocket Agency — Change Log",
      "",
      "## 2026-06-11 (PA — Template Gallery Phase 2)",
      "",
      "### `cwhited26/aipocketagency-website` — `0419192`",
      "",
      "Template Gallery Phase 2 shipped per the SPEC.",
      "",
      "## 2026-06-10 (PA — Webinar funnel)",
      "",
      "Webinar funnel shipped.",
    ].join("\n");
    const entries = extractChangeLogEntries("APA/Change_Log.md", content);
    expect(entries).toHaveLength(2);
    expect(entries[0].date).toBe("2026-06-11");
    expect(entries[0].description).toContain("Template Gallery Phase 2 shipped");
    expect(entries[1].name).toContain("Webinar funnel");
  });

  it("caps at the 50 most recent entries", () => {
    const blocks = Array.from({ length: 60 }, (_, i) =>
      `## 2026-01-${String((i % 28) + 1).padStart(2, "0")} — entry ${i}\n\nBody ${i}.`,
    );
    const entries = extractChangeLogEntries("BOS/BOS_Change_Log.md", blocks.join("\n\n"));
    expect(entries).toHaveLength(50);
    expect(entries[0].name).toContain("entry 0");
  });
});

describe("extractSpecEntry", () => {
  it("uses the H1 and first paragraph", () => {
    const content = [
      "# Pocket Agent — Skills SPEC v1",
      "",
      "Skills are accumulated techniques the dispatcher loads before planning.",
    ].join("\n");
    const entry = extractSpecEntry("APA/Products/Pocket_Agent_Skills_SPEC_v1.md", content);
    expect(entry.type).toBe("spec");
    expect(entry.name).toBe("Pocket Agent — Skills SPEC v1");
    expect(entry.description).toContain("accumulated techniques");
    expect(entry.path).toBe("APA/Products/Pocket_Agent_Skills_SPEC_v1.md");
  });

  it("ignores YAML block-scalar markers and falls back to the body", () => {
    const content = [
      "---",
      "description: >-",
      "  A multiline description",
      "---",
      "# Some SPEC",
      "",
      "The real first paragraph of the spec body.",
    ].join("\n");
    const entry = extractSpecEntry("APA/Products/Some_SPEC.md", content);
    expect(entry.description).toContain("real first paragraph");
  });
});

describe("extractDeepEntries dispatcher", () => {
  it("routes by path and returns nothing for ordinary notes", () => {
    expect(extractDeepEntries("BOS/notes.md", "# Notes\n\nHello.")).toHaveLength(0);
    expect(
      extractDeepEntries("WC/Decision_Log.md", "## Decision WC-1 — 2026-05-09 — Domain\nBody."),
    ).toHaveLength(1);
  });
});
