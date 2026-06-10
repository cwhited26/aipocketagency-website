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
import {
  ideaBuildIdOf,
  ideaBuildSequence,
  nextIdeaCursor,
  stackLine,
  renderBuildMd,
  type IdeaBuildState,
} from "../build";
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
    // With a stack line, the README carries the Stack section (PA-IDEA-8).
    const withStack = renderReadmeMd("My Idea", "my-idea-x", "Next.js on Vercel + Supabase project `abc` + GitHub repo `me/x`");
    expect(withStack).toContain("## Stack");
    expect(withStack).toContain("Supabase project `abc`");
    expect(renderReadmeMd("My Idea", "my-idea-x")).not.toContain("## Stack");
  });
});

// ── Stage-4 auto-build chain (PA-IDEA-8 / PA-IDEA-9) ─────────────────────────────────────────────────

function buildState(over: Partial<IdeaBuildState> = {}): IdeaBuildState {
  return {
    buildKind: "mvp",
    slug: "my-mvp-abc123",
    files: { "app/page.tsx": "x" },
    cursor: "repo",
    needsDatabase: true,
    schemaSql: "create table if not exists public.profiles (id uuid primary key);",
    repoFullName: "me/my-mvp-abc123",
    supabaseProjectRef: null,
    vercelProjectId: null,
    deployUrl: null,
    githubLogin: "me",
    ...over,
  };
}

describe("idea-engine stage-4 build chain", () => {
  it("needs_database=true stages the full five-phase chain: repo → push → Supabase create + migrate → Vercel create + env → deploy", () => {
    const seq = ideaBuildSequence(true);
    expect(seq.map((s) => `${s.connector}:${s.action}`)).toEqual([
      "github_build:create_repo",
      "github_build:push_files",
      "supabase:create_project",
      "supabase:apply_migration",
      "vercel:createProject",
      "vercel:setEnvVars",
      "vercel:triggerDeploy",
    ]);
    // The Supabase project creation + the env injection are both present.
    expect(seq.some((s) => s.connector === "supabase" && s.action === "create_project")).toBe(true);
    expect(seq.some((s) => s.connector === "vercel" && s.action === "setEnvVars")).toBe(true);
  });

  it("needs_database=false drops the Supabase + env-injection steps — repo → push → Vercel create → deploy, and Vercel still deploys", () => {
    const seq = ideaBuildSequence(false);
    expect(seq.map((s) => `${s.connector}:${s.action}`)).toEqual([
      "github_build:create_repo",
      "github_build:push_files",
      "vercel:createProject",
      "vercel:triggerDeploy",
    ]);
    expect(seq.some((s) => s.connector === "supabase")).toBe(false);
    expect(seq.some((s) => s.action === "setEnvVars")).toBe(false);
    // The chain still ends in a deploy.
    expect(seq[seq.length - 1]).toEqual({ cursor: "deploy", connector: "vercel", action: "triggerDeploy" });
  });

  it("never queues a Modal connector step from any stage-4 path (PA-IDEA-9)", () => {
    for (const needsDb of [true, false]) {
      const seq = ideaBuildSequence(needsDb);
      for (const step of seq) {
        expect(step.connector).not.toBe("modal");
        expect(step.connector).not.toBe("modal_sandbox");
        expect(["github_build", "vercel", "supabase"]).toContain(step.connector);
      }
    }
  });

  it("nextIdeaCursor routes the database branch and terminates at live", () => {
    // With a database: push → supabase_project; vercel_project → vercel_env.
    expect(nextIdeaCursor("push", true)).toBe("supabase_project");
    expect(nextIdeaCursor("supabase_project", true)).toBe("supabase_migration");
    expect(nextIdeaCursor("supabase_migration", true)).toBe("vercel_project");
    expect(nextIdeaCursor("vercel_project", true)).toBe("vercel_env");
    expect(nextIdeaCursor("vercel_env", true)).toBe("deploy");
    expect(nextIdeaCursor("deploy", true)).toBe("live");
    // Without a database: push → vercel_project; vercel_project → deploy.
    expect(nextIdeaCursor("push", false)).toBe("vercel_project");
    expect(nextIdeaCursor("vercel_project", false)).toBe("deploy");
    expect(nextIdeaCursor("live", true)).toBeNull();
  });
});

describe("idea-engine build snapshot rendering", () => {
  it("stackLine names every shipped piece, with Supabase only when present", () => {
    expect(stackLine(buildState({ supabaseProjectRef: "abc123ref" }))).toBe(
      "Next.js on Vercel + Supabase project `abc123ref` + GitHub repo `me/my-mvp-abc123`",
    );
    expect(stackLine(buildState({ supabaseProjectRef: null }))).toBe(
      "Next.js on Vercel + GitHub repo `me/my-mvp-abc123`",
    );
  });

  it("renderBuildMd records the Supabase project + schema migration when the MVP has a database", () => {
    const md = renderBuildMd("mvp", buildState({ supabaseProjectRef: "abc123ref" }), "https://my-mvp-abc123.vercel.app");
    expect(md).toContain("**Supabase project:** abc123ref");
    expect(md).toContain("## Schema migration applied");
    expect(md).toContain("create table if not exists public.profiles");
  });

  it("renderBuildMd omits the Supabase block for a database-free MVP", () => {
    const md = renderBuildMd("mvp", buildState({ supabaseProjectRef: null }), "https://my-mvp-abc123.vercel.app");
    expect(md).not.toContain("Supabase project");
    expect(md).toContain("ships without a database");
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
