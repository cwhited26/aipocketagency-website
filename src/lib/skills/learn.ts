// learn.ts — the LEARN-phase Skill write (PA-SKILL-3). After a sub-agent run SUCCEEDS, the 7th
// phase of the Algorithm decides whether the run is worth remembering as a technique. The decision
// is a conservative structured-output LLM call — {action: update | new | none} — tuned to prefer
// `none` over a marginal new Skill and `update` over `new` (no auto-dedup in v1.0, so over-eager
// creation is the failure mode to avoid). A proposed write NEVER lands silently: it stages a
// `skill_evolution_proposal` Inbox card for the owner to approve / edit / reject — except a
// per-Skill auto-evolve UPDATE after the trust window, which writes directly with a passive notice.
//
// Poisoning defense (PA-SKILL-7, §11): a run carrying `untrusted_origin` never reaches this path —
// Skills are learned only from trusted, owner-initiated runs. And a Skill write the owner already
// rejected is not re-proposed.

import { z } from "zod";
import { completeLlm } from "@/lib/llm/dispatch";
import { fetchPaUser } from "@/lib/pa-supabase";
import { extractJsonObject } from "@/lib/orchestrator/planner";
import { createInboxItem, listInboxItems, type InboxItem } from "@/lib/pa-inbox-items";
import type { SubAgentRunRow } from "@/lib/orchestrator/types";
import { evolveSkill, listSkillSummaries, readSkill, type SkillRepo } from "./store";
import {
  skillReachableFromZone,
  skillSlugify,
  type SkillSummary,
} from "./types";

// The zone an owner-initiated run defaults to (mirrors dispatcher DEFAULT_RUN_ZONE).
const DEFAULT_RUN_ZONE = "project-shared";

// ── LLM interface (injected so the classifier is unit-tested without a network) ─────────────

export type SkillLearnLlm = (args: {
  system: string;
  user: string;
}) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;

// ── Decision schema ─────────────────────────────────────────────────────────────────────

export const LearnDecisionSchema = z.object({
  action: z.enum(["none", "new", "update"]),
  // For update: which existing Skill to sharpen.
  targetSlug: z.string().max(80).optional(),
  // For new (and as the refined fields on update): the proposed technique.
  name: z.string().max(120).optional(),
  description: z.string().max(400).optional(),
  whenToUse: z.string().max(600).optional(),
  body: z.string().max(8_000).optional(),
  prerequisites: z.array(z.string().max(300)).max(20).optional(),
  // One line for the proposal card ("This is the 3rd supplement quote you've drafted this way").
  reason: z.string().max(600).optional(),
});
export type LearnDecision = z.infer<typeof LearnDecisionSchema>;

// ── Pure guards (unit-tested) ───────────────────────────────────────────────────────────

export type LearnGuard = { ok: true } | { ok: false; skip: string };

/** Whether a completed run is eligible to propose a Skill. Only a SUCCEEDED, trusted run is —
 *  a failed/canceled run never bakes its move into a technique, and an untrusted-origin run is
 *  barred from the write path entirely (poisoning defense). */
export function skillLearnGuard(run: Pick<SubAgentRunRow, "status" | "untrusted_origin">): LearnGuard {
  if (run.status !== "done") return { ok: false, skip: "run_not_successful" };
  if (run.untrusted_origin === true) return { ok: false, skip: "untrusted_origin" };
  return { ok: true };
}

/** True when this exact write was already proposed and is pending OR was rejected by the owner —
 *  so PA never re-proposes a Skill write the owner just turned down (or one already in the queue). */
export function isProposalSuppressed(
  decision: { action: "new" | "update"; slug: string },
  existing: InboxItem[],
): boolean {
  return existing.some((item) => {
    if (item.kind !== "skill_evolution_proposal") return false;
    if (item.status !== "pending" && item.status !== "rejected") return false;
    const p = item.payload as { slug?: unknown; action?: unknown };
    return p.slug === decision.slug && p.action === decision.action;
  });
}

// ── Prompt ─────────────────────────────────────────────────────────────────────────────

const LEARN_SYSTEM = [
  "You are Pocket Agent's LEARN phase. A sub-agent run just SUCCEEDED. Decide whether the run used",
  "a reusable TECHNIQUE worth remembering as a Skill — a repeatable move (\"draft a roof supplement",
  "quote\"), not a one-off fact and not a whole multi-move workflow.",
  "Be conservative. Most runs do NOT warrant a Skill. Prefer 'none' over a marginal new Skill, and",
  "prefer 'update' (sharpen an existing Skill) over 'new' when the run matches one that already exists.",
  "Only propose 'new' when the move is genuinely not covered by any existing Skill.",
  "When you do propose, write the body as a numbered sequence of steps in the owner's plain voice —",
  "what to do, what good output looks like, and what to refuse. No fluff, no 'I hope this finds you well'.",
  "Return ONLY a single JSON object, no prose, matching exactly:",
  '{"action":"none"|"new"|"update","targetSlug"?:string,"name"?:string,"description"?:string,',
  ' "whenToUse"?:string,"body"?:string,"prerequisites"?:string[],"reason"?:string}',
  "For 'none' return just {\"action\":\"none\"}.",
].join(" ");

function buildLearnPrompt(input: {
  goal: string;
  resultSummary: string;
  candidates: SkillSummary[];
}): string {
  const candidates = input.candidates.length
    ? input.candidates.map((s) => `- ${s.slug}: ${s.description || s.name}`).join("\n")
    : "(none yet)";
  return [
    `GOAL: ${input.goal}`,
    `OUTCOME: ${input.resultSummary || "(completed; no summary provided)"}`,
    "EXISTING SKILLS (reachable in this run's zone):",
    candidates,
    "Decide the action as JSON only.",
  ].join("\n");
}

/** Runs the classifier. Returns a validated decision, or {action:'none'} when the LLM is
 *  unavailable or returns garbage — never throws, never over-proposes on a parse failure. */
export async function classifySkillFromRun(
  input: { goal: string; resultSummary: string; candidates: SkillSummary[] },
  llm: SkillLearnLlm,
): Promise<LearnDecision> {
  let res: Awaited<ReturnType<SkillLearnLlm>>;
  try {
    res = await llm({ system: LEARN_SYSTEM, user: buildLearnPrompt(input) });
  } catch {
    return { action: "none" };
  }
  if (!res.ok) return { action: "none" };
  const json = extractJsonObject(res.text);
  if (!json) return { action: "none" };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { action: "none" };
  }
  const parsed = LearnDecisionSchema.safeParse(raw);
  return parsed.success ? parsed.data : { action: "none" };
}

// ── spec_json extraction ──────────────────────────────────────────────────────────────

type RunSpec = { goal: string; zone: string; loadedSkillSlugs: string[] };

export function readRunSpec(specJson: unknown): RunSpec {
  const s = (specJson ?? {}) as Record<string, unknown>;
  const goal = typeof s.goal === "string" ? s.goal : "";
  const zone = typeof s.zone === "string" && s.zone.trim() ? s.zone : DEFAULT_RUN_ZONE;
  const loaded = Array.isArray(s.loadedSkillSlugs)
    ? s.loadedSkillSlugs.filter((x): x is string => typeof x === "string")
    : [];
  return { goal, zone, loadedSkillSlugs: loaded };
}

// ── Orchestration (the I/O wiring the webhook calls) ────────────────────────────────────

export type SkillLearnResult =
  | { ok: true; action: "none" }
  | { ok: true; action: "proposed"; slug: string; inboxItemId: string }
  | { ok: true; action: "auto_evolved"; slug: string; version: number }
  | { ok: false; skip: string };

/** The default LEARN LLM — PA-managed Claude via the BYO dispatcher, keyed by the owner's stored
 *  Anthropic key (mirrors the dispatcher's planner LLM). */
export function defaultSkillLearnLlm(businessId: string): SkillLearnLlm {
  return async ({ system, user }) => {
    const paRes = await fetchPaUser(businessId);
    const key = paRes.ok && paRes.data ? paRes.data.anthropic_api_key ?? "" : "";
    const res = await completeLlm({
      userId: businessId,
      paManagedKey: key,
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: 1_400,
    });
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, text: res.text };
  };
}

function proposalBody(decision: LearnDecision, isNew: boolean, name: string): string {
  const lines: string[] = [];
  lines.push(
    isNew
      ? `Pocket Agent wants to remember a new technique: **${name}**.`
      : `Pocket Agent wants to sharpen **${name}**.`,
  );
  if (decision.reason) lines.push("", decision.reason);
  if (decision.description) lines.push("", `_What it's for:_ ${decision.description}`);
  lines.push("", "Review the full technique below — approve to save it to your brain, edit it first, or reject it.");
  if (decision.body) lines.push("", "---", "", decision.body.trim());
  return lines.join("\n");
}

/**
 * The LEARN-phase Skill write for one completed run. Loads the reachable Skills, classifies the
 * run, then either stages a proposal or (for an auto-evolve UPDATE past the trust window) writes
 * directly with a passive notice. All effects are scoped to the owner; the caller wraps this
 * best-effort so a LEARN error never fails the (already-completed) run callback.
 */
export async function proposeSkillFromRun(input: {
  run: SubAgentRunRow;
  repo: string;
  token: string | null;
  llm: SkillLearnLlm;
  stampIso: string;
}): Promise<SkillLearnResult> {
  const guard = skillLearnGuard(input.run);
  if (!guard.ok) return { ok: false, skip: guard.skip };

  const spec = readRunSpec(input.run.spec_json);
  const ctx: SkillRepo = { repo: input.repo, token: input.token };

  const all = await listSkillSummaries(ctx);
  const reachable = all.filter((s) => skillReachableFromZone(s.zone, spec.zone));

  const decision = await classifySkillFromRun(
    { goal: spec.goal, resultSummary: input.run.result_summary ?? "", candidates: reachable },
    input.llm,
  );
  if (decision.action === "none") return { ok: true, action: "none" };

  // Resolve the target slug + display name for both branches.
  const name = (decision.name ?? "").trim();
  const updateTarget =
    decision.action === "update" && decision.targetSlug
      ? reachable.find((s) => s.slug === decision.targetSlug)
      : undefined;

  // An 'update' whose target isn't reachable (or missing) degrades to a no-op rather than
  // silently creating an out-of-zone Skill.
  if (decision.action === "update" && !updateTarget) return { ok: true, action: "none" };

  if (!decision.body || (!updateTarget && !name)) return { ok: true, action: "none" };

  const slug = updateTarget ? updateTarget.slug : skillSlugify(name);
  const effectiveAction: "new" | "update" = updateTarget ? "update" : "new";

  // Re-proposal suppression: skip a write the owner already rejected or that's already queued.
  const existing = await listInboxItems(input.run.business_id);
  if (existing.ok && isProposalSuppressed({ action: effectiveAction, slug }, existing.data)) {
    return { ok: true, action: "none" };
  }

  // Auto-evolve (PA-SKILL-3): a trusted UPDATE to a Skill the owner has flipped auto-evolve on for
  // writes directly — version row + passive notice, never an approval gate. New Skills never
  // auto-evolve.
  if (effectiveAction === "update" && updateTarget?.autoEvolve) {
    const current = await readSkill(ctx, slug);
    if (current) {
      const written = await evolveSkill(
        ctx,
        {
          body: decision.body,
          description: decision.description ?? current.frontmatter.description,
          whenToUse: decision.whenToUse ?? current.frontmatter.whenToUse,
          prerequisites: decision.prerequisites,
        },
        current,
        input.stampIso,
        { fromRunId: input.run.id },
      );
      if (written.ok) {
        await createInboxItem({
          userId: input.run.business_id,
          kind: "sub_agent_activity",
          title: `Sharpened a skill: ${current.frontmatter.name}`,
          bodyMd: `I updated **${current.frontmatter.name}** to v${written.version} on my own (auto-evolve is on for this skill). You can roll it back any time in Skills.`,
          source: "skill-learn",
          payload: { slug, version: written.version, autoEvolved: true },
        });
        return { ok: true, action: "auto_evolved", slug, version: written.version };
      }
    }
    // Fall through to a normal proposal if the direct write couldn't complete.
  }

  // Stage a proposal card for owner review (the primary defense + the normal path).
  const displayName = updateTarget ? updateTarget.name : name;
  const created = await createInboxItem({
    userId: input.run.business_id,
    kind: "skill_evolution_proposal",
    title: updateTarget ? `Sharpen skill: ${displayName}` : `New skill: ${displayName}`,
    bodyMd: proposalBody(decision, !updateTarget, displayName),
    source: "skill-learn",
    payload: {
      action: effectiveAction,
      slug,
      name: displayName,
      proposedBody: decision.body,
      proposedDescription: decision.description ?? "",
      proposedWhenToUse: decision.whenToUse ?? "",
      proposedPrerequisites: decision.prerequisites ?? [],
      proposedZone: updateTarget ? updateTarget.zone : spec.zone,
      currentVersion: updateTarget ? updateTarget.version : 0,
      runId: input.run.id,
      reason: decision.reason ?? "",
    },
  });
  if (!created.ok) return { ok: false, skip: `proposal_stage_failed:${created.error}` };
  return { ok: true, action: "proposed", slug, inboxItemId: created.data.id };
}

/** Webhook entry: resolve the owner's brain repo + token, build the default LLM, and run the
 *  LEARN-phase Skill write. Returns a skip result (never throws) when there's no brain. */
export async function runSkillLearnPhase(
  run: SubAgentRunRow,
  stampIso: string,
): Promise<SkillLearnResult> {
  const guard = skillLearnGuard(run);
  if (!guard.ok) return { ok: false, skip: guard.skip };

  const paRes = await fetchPaUser(run.business_id);
  const repo = paRes.ok && paRes.data ? paRes.data.brain_repo : null;
  const token = paRes.ok && paRes.data ? paRes.data.github_token : null;
  if (!repo) return { ok: false, skip: "no_brain_repo" };

  return proposeSkillFromRun({
    run,
    repo,
    token,
    llm: defaultSkillLearnLlm(run.business_id),
    stampIso,
  });
}
