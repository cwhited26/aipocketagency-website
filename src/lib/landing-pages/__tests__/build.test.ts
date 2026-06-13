// build.test.ts — the build orchestrator. Pure helpers (slug, deterministic fill, scaffold, the stage
// plan) plus the orchestrator loop: each step runs through an injected runner, fail-stopping at the
// first rejection, and an end-to-end run against a mock GitHub + Vercel pair returns the live URL. No
// network — the runner IS the mock build backend.

import { describe, it, expect } from "vitest";
import {
  fillTemplate,
  landingSlug,
  nextCursorAfter,
  planLandingBuildSteps,
  runLandingPageBuild,
  scaffoldFiles,
  stagePlanFor,
  type PlannedStep,
  type StepOutcome,
} from "../build";
import { getTemplate } from "../templates";
import type { GeneratedBundle, LandingPageRow } from "../types";

const COPY = {
  hero: "New roof, no surprises\nHonest quotes near Knoxville.",
  problem: "The problem\nYou can't get a straight price.",
  mechanism: "How it works\n- Inspect\n- Quote\n- Build",
  cta: "Ready?\nGet a free inspection.",
};

function bundle(): GeneratedBundle {
  const template = getTemplate("single-cta");
  if (!template) throw new Error("template missing");
  const files = { ...scaffoldFiles("Roofing"), "app/page.tsx": fillTemplate(template, COPY) };
  return { copy: COPY, files };
}

function pageRow(overrides: Partial<LandingPageRow> = {}): LandingPageRow {
  return {
    id: "abc123def456",
    owner_id: "owner-1",
    project_id: null,
    title: "Roofing — free inspection",
    description: "A roofing page",
    template: "single-cta",
    brain_scope: null,
    generated_copy: bundle(),
    github_repo_name: null,
    vercel_project_id: null,
    vercel_url: null,
    custom_domain: null,
    status: "building",
    build_step: "repo",
    created_at: "2026-06-09T00:00:00Z",
    updated_at: "2026-06-09T00:00:00Z",
    ...overrides,
  };
}

describe("pure helpers", () => {
  it("landingSlug is lowercase, GitHub/Vercel-safe, and id-suffixed", () => {
    const slug = landingSlug("Roofing — Free Inspection!", "abc123XYZ");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug.startsWith("roofing-free-inspection")).toBe(true);
    expect(slug).toContain("abc123");
  });

  it("fillTemplate injects the copy as data and leaves a compilable component", () => {
    const template = getTemplate("single-cta");
    if (!template) return;
    const src = fillTemplate(template, COPY);
    expect(src).not.toContain("{{COPY_JSON}}");
    expect(src).toContain("export default function");
    expect(src).toContain("New roof, no surprises");
  });

  it("scaffoldFiles is a deployable Next project", () => {
    const files = scaffoldFiles("My Page");
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(["package.json", "next.config.mjs", "tsconfig.json", "app/layout.tsx", "app/globals.css"]),
    );
    const pkg = JSON.parse(files["package.json"]) as { dependencies: Record<string, string> };
    expect(pkg.dependencies.next).toBeTruthy();
    expect(files["app/layout.tsx"]).toContain("My Page");
  });

  it("planLandingBuildSteps is the four-step sequence in order", () => {
    const steps = planLandingBuildSteps("acme-site");
    expect(steps.map((s) => s.step)).toEqual([
      "create_repo",
      "push_files",
      "create_project",
      "trigger_deploy",
    ]);
  });

  it("nextCursorAfter maps each connector action to the next cursor", () => {
    expect(nextCursorAfter("create_repo")).toBe("push");
    expect(nextCursorAfter("push_files")).toBe("project");
    expect(nextCursorAfter("createProject")).toBe("deploy");
    expect(nextCursorAfter("triggerDeploy")).toBe("live");
    expect(nextCursorAfter("nope")).toBeNull();
  });
});

describe("stagePlanFor", () => {
  it("stages create_repo with the slug + landing_page_id", () => {
    const plan = stagePlanFor("repo", pageRow(), null);
    expect(plan?.connector).toBe("github_build");
    expect(plan?.action).toBe("create_repo");
    expect(plan?.payload.landing_page_id).toBe("abc123def456");
    expect(typeof plan?.payload.name).toBe("string");
  });

  it("stages push_files with the generated project files", () => {
    const plan = stagePlanFor("push", pageRow({ github_repo_name: "acme/roofing" }), null);
    expect(plan?.action).toBe("push_files");
    const files = plan?.payload.files as Array<{ path: string }>;
    expect(files.some((f) => f.path === "app/page.tsx")).toBe(true);
    expect(plan?.payload.repo).toBe("acme/roofing");
  });

  it("stages createProject linked to the repo", () => {
    const plan = stagePlanFor("project", pageRow({ github_repo_name: "acme/roofing" }), null);
    expect(plan?.connector).toBe("vercel");
    expect(plan?.action).toBe("createProject");
    expect(plan?.payload.gitRepo).toBe("acme/roofing");
  });

  it("does not stage deploy until a Vercel project id exists", () => {
    expect(stagePlanFor("deploy", pageRow(), null)).toBeNull();
    const plan = stagePlanFor("deploy", pageRow({ vercel_project_id: "prj_1" }), null);
    expect(plan?.action).toBe("triggerDeploy");
    expect(plan?.payload.projectId).toBe("prj_1");
  });
});

describe("runLandingPageBuild orchestrator", () => {
  it("fail-stops at the first rejected step and runs no step after it", async () => {
    const ran: string[] = [];
    const runner = async (step: PlannedStep): Promise<StepOutcome> => {
      ran.push(step.step);
      if (step.step === "push_files") return { status: "rejected", reason: "owner said no" };
      return { status: "executed", data: {} };
    };

    const result = await runLandingPageBuild({ slug: "acme-site", files: {}, runner });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stoppedAt).toBe("push_files");
      expect(result.reason).toBe("owner said no");
    }
    // create_repo + push_files ran; create_project + trigger_deploy did NOT.
    expect(ran).toEqual(["create_repo", "push_files"]);
  });

  it("runs end-to-end on a mock GitHub + Vercel pair and returns the live URL", async () => {
    const files = bundle().files;
    const seen: Record<string, unknown> = {};
    const runner = async (step: PlannedStep, ctx: { files: Record<string, string> }): Promise<StepOutcome> => {
      switch (step.step) {
        case "create_repo":
          return { status: "executed", data: { full_name: "acme/acme-site" } };
        case "push_files":
          // The generated page made it into the build context.
          seen.pushedPage = ctx.files["app/page.tsx"];
          return { status: "executed", data: { commit_sha: "deadbeef" } };
        case "create_project":
          return { status: "executed", data: { projectId: "prj_99" } };
        case "trigger_deploy":
          return { status: "executed", data: { url: "https://acme-site-xyz.vercel.app" } };
        default:
          return { status: "failed", error: "unknown step" };
      }
    };

    const result = await runLandingPageBuild({ slug: "acme-site", files, runner });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe("https://acme-site-xyz.vercel.app");
    expect(typeof seen.pushedPage).toBe("string");
    expect(seen.pushedPage as string).toContain("New roof, no surprises");
  });

  it("falls back to <slug>.vercel.app when the deploy returns no URL", async () => {
    const runner = async (step: PlannedStep): Promise<StepOutcome> => {
      if (step.step === "create_repo") return { status: "executed", data: { full_name: "acme/acme-site" } };
      if (step.step === "create_project") return { status: "executed", data: { projectId: "prj_1" } };
      return { status: "executed", data: {} };
    };
    const result = await runLandingPageBuild({ slug: "acme-site", files: {}, runner });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe("https://acme-site.vercel.app");
  });
});
