// advance.ts — the staging glue between a landing page row and the shipped Build connectors. It stages
// each build step as a `build_action_approval` Inbox card (reusing the Build Tools middleware, no new
// approval plumbing), and advances the build one step per approved connector action.
//
// The flow:
//   1. startLandingPageBuild — generate the copy (voice) + the code (metered), persist them, and stage
//      the first step (create the repo).
//   2. advanceLandingPageBuildAfterApproval — called by the approval route after a build step executes:
//      record the artifact (repo name / Vercel project id / live URL), move the cursor, and stage the
//      next step. push_files is NEVER auto-approved (the connector enforces it); the owner taps each.
//   3. failLandingPageBuildAfterRejection — a rejected step marks the build failed (owner can retry).
//   4. stageCustomDomain — attach a custom domain later via the Vercel attachDomain connector.

import { stageConnectorAction, scopeToken } from "@/lib/orchestrator/tool-use";
import type { CostContext } from "@/lib/cost/log";
import { generateLandingCopy } from "./generate-copy";
import { assembleLandingBundle, landingSlug, nextCursorAfter, stagePlanFor } from "./build";
import { resolveLandingTemplate } from "./directions";
import { getPage, updatePage } from "./pages";
import type { BuildStep, LandingPageRow } from "./types";

export type AdvanceResult = { ok: true; staged: boolean } | { ok: false; status: number; error: string };

function str(data: Record<string, unknown>, key: string): string | null {
  const v = data[key];
  return typeof v === "string" && v ? v : null;
}

/** Stage one build step's connector action as a build_action_approval card. */
async function stageStep(
  page: LandingPageRow,
  cursor: BuildStep,
  ownerId: string,
): Promise<{ staged: boolean }> {
  const plan = stagePlanFor(cursor, page, null);
  if (!plan) return { staged: false };

  await stageConnectorAction({
    userId: ownerId,
    subAgentRunId: null,
    connector: plan.connector,
    action: plan.action,
    payload: plan.payload,
    declaredScopes: [scopeToken(plan.connector, plan.action)],
    title: plan.title,
    preview: plan.preview,
    kind: "build_action_approval",
  });
  return { staged: true };
}

/**
 * Kick off (or restart) a build: write the copy in the owner's voice, generate the page code, persist
 * the bundle, and stage the first connector step. Both LLM calls meter the cost ledger. A generation
 * failure flips the page to `failed` and returns the error (surfaced, never swallowed silently).
 */
export async function startLandingPageBuild(params: {
  page: LandingPageRow;
  ownerId: string;
  anthropicApiKey: string;
  brainRepo: string | null;
  githubToken: string | null;
}): Promise<AdvanceResult> {
  const template = resolveLandingTemplate(params.page.template);
  if (!template) {
    return { ok: false, status: 422, error: `Unknown template "${params.page.template}".` };
  }

  const scopeMeta = params.page.brain_scope ? { brain_scope: params.page.brain_scope } : undefined;
  const copyCost: CostContext = {
    ownerId: params.ownerId,
    featureSlug: "landing_page_builder",
    idempotencyKey: `landing:${params.page.id}:copy`,
    metadata: scopeMeta,
  };
  const codeCost: CostContext = {
    ownerId: params.ownerId,
    featureSlug: "landing_page_builder",
    idempotencyKey: `landing:${params.page.id}:code`,
    metadata: scopeMeta,
  };

  let bundle;
  try {
    const { copy } = await generateLandingCopy(
      { template, description: params.page.description, scope: params.page.brain_scope },
      params.anthropicApiKey,
      params.brainRepo,
      params.githubToken,
      copyCost,
    );
    bundle = await assembleLandingBundle(
      { template, copy, title: params.page.title, scope: params.page.brain_scope },
      params.anthropicApiKey,
      codeCost,
    );
  } catch (err) {
    await updatePage(params.page.id, params.ownerId, { status: "failed", buildStep: "failed" });
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : "Generation failed",
    };
  }

  const updated = await updatePage(params.page.id, params.ownerId, {
    generatedCopy: bundle,
    status: "building",
    buildStep: "repo",
  });
  if (!updated.ok) return updated;

  const staged = await stageStep(updated.data, "repo", params.ownerId);
  return { ok: true, staged: staged.staged };
}

/**
 * Advance a build after one of its connector steps executed. Records the step's artifact, moves the
 * cursor, and stages the next step. Best-effort by contract (the approval route already executed the
 * connector action) — every failure is returned, never thrown, so it can't undo a real success.
 */
export async function advanceLandingPageBuildAfterApproval(params: {
  landingPageId: string;
  ownerId: string;
  action: string;
  data: Record<string, unknown>;
}): Promise<AdvanceResult> {
  const found = await getPage(params.landingPageId, params.ownerId);
  if (!found.ok) return found;
  if (!found.data) return { ok: false, status: 404, error: "Landing page not found" };
  const page = found.data;

  // attachDomain is out-of-band from the linear build — record the domain and stop.
  if (params.action === "attachDomain") {
    const domain = str(params.data, "domain");
    if (domain) await updatePage(page.id, params.ownerId, { customDomain: domain });
    return { ok: true, staged: false };
  }

  const cursor = nextCursorAfter(params.action);
  if (!cursor) return { ok: true, staged: false };

  const slug = landingSlug(page.title, page.id);

  if (params.action === "create_repo") {
    const updated = await updatePage(page.id, params.ownerId, {
      githubRepoName: str(params.data, "full_name") ?? slug,
      buildStep: "push",
    });
    if (!updated.ok) return updated;
    const staged = await stageStep(updated.data, "push", params.ownerId);
    return { ok: true, staged: staged.staged };
  }

  if (params.action === "push_files") {
    const updated = await updatePage(page.id, params.ownerId, { buildStep: "project" });
    if (!updated.ok) return updated;
    const staged = await stageStep(updated.data, "project", params.ownerId);
    return { ok: true, staged: staged.staged };
  }

  if (params.action === "createProject") {
    const updated = await updatePage(page.id, params.ownerId, {
      vercelProjectId: str(params.data, "projectId"),
      buildStep: "deploy",
    });
    if (!updated.ok) return updated;
    const staged = await stageStep(updated.data, "deploy", params.ownerId);
    return { ok: true, staged: staged.staged };
  }

  // triggerDeploy → the page is live.
  const url = str(params.data, "url") ?? `https://${slug}.vercel.app`;
  const updated = await updatePage(page.id, params.ownerId, {
    vercelUrl: url,
    status: "live",
    buildStep: "live",
  });
  if (!updated.ok) return updated;

  // PA-LPB-9 locked answer #4: if the scope's brand.json had a `domain` field (read at create-time
  // and stored in brain_scope_domain), propose attaching it via the existing Vercel attachDomain
  // connector. Always approval-gated, never auto-fire.
  const scopeDomain = updated.data.brain_scope_domain;
  if (scopeDomain && updated.data.vercel_project_id) {
    await stageConnectorAction({
      userId: params.ownerId,
      subAgentRunId: null,
      connector: "vercel",
      action: "attachDomain",
      payload: {
        projectId: updated.data.vercel_project_id,
        domain: scopeDomain,
        landing_page_id: page.id,
      },
      declaredScopes: [scopeToken("vercel", "attachDomain")],
      title: `Attach ${scopeDomain} to "${page.title}"`,
      preview: `Your ${page.brain_scope ?? "project"}'s brand.json lists ${scopeDomain}. Approve this step and Pocket Agent will point it at your live page. Add the DNS records Vercel shows to finish.`,
      kind: "build_action_approval",
    });
    return { ok: true, staged: true };
  }

  return { ok: true, staged: false };
}

/** Mark a build failed when the owner rejects one of its staged steps. */
export async function failLandingPageBuildAfterRejection(params: {
  landingPageId: string;
  ownerId: string;
}): Promise<AdvanceResult> {
  const updated = await updatePage(params.landingPageId, params.ownerId, {
    status: "failed",
    buildStep: "failed",
  });
  if (!updated.ok) return updated;
  return { ok: true, staged: false };
}

/** Stage a Vercel attachDomain approval for a live page's custom domain (single-approval forever). */
export async function stageCustomDomain(params: {
  page: LandingPageRow;
  ownerId: string;
  domain: string;
}): Promise<AdvanceResult> {
  if (!params.page.vercel_project_id) {
    return { ok: false, status: 409, error: "Deploy the page before attaching a custom domain." };
  }
  await stageConnectorAction({
    userId: params.ownerId,
    subAgentRunId: null,
    connector: "vercel",
    action: "attachDomain",
    payload: {
      projectId: params.page.vercel_project_id,
      domain: params.domain,
      landing_page_id: params.page.id,
    },
    declaredScopes: [scopeToken("vercel", "attachDomain")],
    title: `Attach ${params.domain} to "${params.page.title}"`,
    preview: `Pocket Agent will point ${params.domain} at your live page. You'll add the DNS records Vercel shows to finish.`,
    kind: "build_action_approval",
  });
  return { ok: true, staged: true };
}
