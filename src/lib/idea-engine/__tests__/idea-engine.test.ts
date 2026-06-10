import { describe, it, expect } from "vitest";
import {
  STAGES,
  STAGE_NUMBERS,
  stageDef,
  ideaSlug,
  snapshotPath,
  costKey,
  toIdeaView,
  type IdeaRow,
  type StageRunRow,
} from "../types";
import { latestRunsByStage } from "../store";
import {
  renderIdeaMd,
  renderMarketScanMd,
  renderProspectsMd,
  renderReadmeMd,
} from "../snapshot";
import { isBlueprintDecision } from "../engine";
import { ideaBuildIdOf } from "../build";
import {
  tierCanSeeIdeaEngine,
  tierAllowsIdeaEngine,
  tierAllowsIdeaEngineAutoBuild,
} from "@/lib/personas/tier-caps";

describe("idea-engine types", () => {
  it("defines exactly six stages, numbered 1..6, each with a backbone", () => {
    expect(STAGES).toHaveLength(6);
    expect(STAGES.map((s) => s.stage)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(STAGE_NUMBERS).toEqual([1, 2, 3, 4, 5, 6]);
    for (const s of STAGES) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.backbone.length).toBeGreaterThan(0);
    }
  });

  it("stages 3, 4, 5, 6 pause for approval; 1 and 2 do not", () => {
    expect(stageDef(1)?.stagesForApproval).toBe(false);
    expect(stageDef(2)?.stagesForApproval).toBe(false);
    expect(stageDef(3)?.stagesForApproval).toBe(true);
    expect(stageDef(4)?.stagesForApproval).toBe(true);
    expect(stageDef(5)?.stagesForApproval).toBe(true);
    expect(stageDef(6)?.stagesForApproval).toBe(true);
    expect(stageDef(7)).toBeNull();
  });

  it("ideaSlug is lowercase, hyphenated, id-suffixed, and bounded", () => {
    const slug = ideaSlug("AI Tutoring App for Kids Learning Spanish!", "abc123def456");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug.endsWith("abc123")).toBe(true);
    // Empty title still produces a safe slug.
    expect(ideaSlug("", "")).toMatch(/^idea-draft$/);
  });

  it("snapshotPath nests under brain/ideas/<slug>", () => {
    expect(snapshotPath("widget-xyz")).toBe("brain/ideas/widget-xyz");
  });

  it("costKey uses the deterministic idea:<id>:stage:<N>:<step> shape (PA-IDEA-6)", () => {
    expect(costKey("idea-1", 2, "serp")).toBe("idea:idea-1:stage:2:serp");
    expect(costKey("idea-1", 6, "outreach:3")).toBe("idea:idea-1:stage:6:outreach:3");
  });
});

function idea(overrides: Partial<IdeaRow> = {}): IdeaRow {
  return {
    id: "i1",
    owner_id: "o1",
    slug: "test-idea-i1",
    title: "Test idea",
    source: "typed",
    source_payload: {},
    current_stage: 2,
    status: "active",
    snapshot_brain_path: "brain/ideas/test-idea-i1",
    created_at: "2026-06-09T00:00:00Z",
    updated_at: "2026-06-09T00:00:00Z",
    ...overrides,
  };
}

function run(stage: number, status: StageRunRow["status"], created: string): StageRunRow {
  return {
    id: `r-${stage}-${created}`,
    idea_id: "i1",
    owner_id: "o1",
    stage,
    status,
    output: {},
    error: null,
    started_at: null,
    completed_at: status === "complete" ? created : null,
    created_at: created,
    updated_at: created,
  };
}

describe("latestRunsByStage", () => {
  it("keeps the newest run per stage from a newest-first list", () => {
    const runs = [
      run(2, "complete", "2026-06-09T03:00:00Z"),
      run(2, "error", "2026-06-09T01:00:00Z"),
      run(1, "complete", "2026-06-09T00:30:00Z"),
    ];
    const map = latestRunsByStage(runs);
    expect(map.get(2)?.status).toBe("complete");
    expect(map.get(1)?.status).toBe("complete");
    expect(map.has(3)).toBe(false);
  });
});

describe("toIdeaView", () => {
  it("marks stages with no run as not_started and reflects run status otherwise", () => {
    const map = new Map<number, StageRunRow>([
      [1, run(1, "complete", "2026-06-09T00:00:00Z")],
      [2, run(2, "complete", "2026-06-09T01:00:00Z")],
      [3, run(3, "staged", "2026-06-09T02:00:00Z")],
    ]);
    const view = toIdeaView(idea(), map);
    expect(view.stages).toHaveLength(6);
    expect(view.stages[0].status).toBe("complete");
    expect(view.stages[2].status).toBe("staged");
    expect(view.stages[3].status).toBe("not_started");
    expect(view.title).toBe("Test idea");
  });
});

describe("blueprint + build payload detection", () => {
  it("isBlueprintDecision matches only the ideaEngine stage-3 decision payload", () => {
    expect(isBlueprintDecision({ ideaEngine: true, stage: 3, ideaId: "x" })).toEqual({ ideaId: "x" });
    expect(isBlueprintDecision({ ideaEngine: true, stage: 4, ideaId: "x" })).toBeNull();
    expect(isBlueprintDecision({ stage: 3, ideaId: "x" })).toBeNull();
    expect(isBlueprintDecision({})).toBeNull();
  });

  it("ideaBuildIdOf returns the idea_id only when present", () => {
    expect(ideaBuildIdOf({ idea_id: "abc" })).toBe("abc");
    expect(ideaBuildIdOf({ idea_id: "" })).toBeNull();
    expect(ideaBuildIdOf({ landing_page_id: "lp1" })).toBeNull();
  });
});

describe("snapshot renderers", () => {
  it("renders the idea, market scan, prospects, and README markdown", () => {
    expect(renderIdeaMd("My Idea", "voice", "the detail")).toContain("# My Idea");
    expect(renderIdeaMd("My Idea", "voice", "the detail")).toContain("the detail");

    const scanMd = renderMarketScanMd({
      ideaSpace: "tutoring",
      vertical: "parents",
      competitorCount: 3,
      strongestCompetitor: "Acme",
      priceRange: "$10-30/mo",
      icp: "parents of K-5",
      prospects: [],
    });
    expect(scanMd).toContain("# Market scan — tutoring");
    expect(scanMd).toContain("Acme");

    const prospectsMd = renderProspectsMd([
      { name: "Biz One", website: "https://one.com", summary: "x", contact: "a@one.com", fit: "Strong fit", category: "edu" },
    ]);
    expect(prospectsMd).toContain("Prospects (1)");
    expect(prospectsMd).toContain("Biz One");

    expect(renderReadmeMd("My Idea", "my-idea-x")).toContain("brain/ideas/my-idea-x/");
  });
});

describe("idea-engine tier gating (PA-IDEA-3)", () => {
  it("Pro+ and above see + use the engine; Free/Pro do not", () => {
    expect(tierCanSeeIdeaEngine("starter")).toBe(false);
    expect(tierCanSeeIdeaEngine("pro")).toBe(false);
    expect(tierCanSeeIdeaEngine("pro_plus")).toBe(true);
    expect(tierAllowsIdeaEngine("pro")).toBe(false);
    expect(tierAllowsIdeaEngine("pro_plus")).toBe(true);
    expect(tierAllowsIdeaEngine("enterprise")).toBe(true);
  });

  it("auto-build is Studio+/Enterprise only; Pro+/Studio fall back to prompt-pack", () => {
    expect(tierAllowsIdeaEngineAutoBuild("pro_plus")).toBe(false);
    expect(tierAllowsIdeaEngineAutoBuild("studio")).toBe(false);
    expect(tierAllowsIdeaEngineAutoBuild("studio_plus")).toBe(true);
    expect(tierAllowsIdeaEngineAutoBuild("enterprise")).toBe(true);
  });
});
