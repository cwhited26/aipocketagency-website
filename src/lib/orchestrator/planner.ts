// planner.ts — Project Scaffolding (Jeff Hunter pattern, PA-ORCH-13). Turns a user goal into
// a structured Project → Milestones → Tasks plan the owner approves BEFORE the dispatcher
// fires sub-agents at the leaf tasks. Simple goals (single-tool, read-only, short) skip the
// scaffolding step entirely — overhead would dominate.
//
// The LLM call is injected as a dependency so the routing heuristic, prompt assembly, and
// plan parsing are unit-tested with a mock LLM (no network in tests).

import {
  ScaffoldSchema,
  estimateAgentMinutes,
  type Scaffold,
  type SubAgentSpec,
} from "./types";

// ── Simple-vs-scaffolded routing ────────────────────────────────────────────────────────

// Verbs that imply an external write / multi-step work → always scaffold.
const ACTION_VERBS = [
  "send",
  "email",
  "draft",
  "reply",
  "follow up",
  "follow-up",
  "create",
  "make",
  "build",
  "write",
  "post",
  "publish",
  "schedule",
  "book",
  "charge",
  "invoice",
  "refund",
  "commit",
  "deploy",
  "update",
  "change",
  "fix",
  "generate",
  "set up",
  "launch",
  "plan",
  "organize",
  "prepare",
];

// Verbs that imply a single read-only lookup → eligible to skip scaffolding.
const READ_VERBS = [
  "what",
  "who",
  "when",
  "where",
  "which",
  "show",
  "list",
  "find",
  "look up",
  "lookup",
  "search",
  "check",
  "tell me",
  "how many",
  "summarize",
  "summarise",
];

function hasAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/**
 * True when a goal is simple enough to answer directly without spawning a scaffold:
 * short, read-only phrasing, no action verbs, and no obvious multi-step conjunctions.
 * Conservative — when in doubt it returns false so the goal gets a reviewable plan.
 */
export function isSimpleGoal(goal: string): boolean {
  const g = goal.trim().toLowerCase();
  if (!g) return true; // nothing to do
  // Multi-clause goals ("do X and Y, then Z") are never simple.
  const clauseCount =
    (g.match(/\band\b/g)?.length ?? 0) +
    (g.match(/\bthen\b/g)?.length ?? 0) +
    (g.match(/[;\n]/g)?.length ?? 0);
  if (clauseCount >= 1) return false;
  if (g.length > 160) return false;
  if (hasAny(g, ACTION_VERBS)) return false;
  return hasAny(g, READ_VERBS);
}

// ── Plan generation ─────────────────────────────────────────────────────────────────────

/** A minimal LLM interface the planner depends on (injected by the dispatcher). */
export type PlannerLlm = (args: {
  system: string;
  user: string;
}) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;

export type PlannerContext = {
  // Connectors the owner has connected + write-capable (free text names; resolved later).
  availableConnectors: string[];
  // Persona names available as executors.
  availablePersonas: string[];
};

const SCAFFOLD_SYSTEM = [
  "You are Pocket Agent's Scaffolder. You decompose a business owner's goal into a structured,",
  "reviewable project plan BEFORE any work is dispatched. Follow the Project → Milestones → Tasks",
  "hierarchy. Be concrete and minimal: 1–5 milestones, 1–5 tasks each. Each task names which",
  "connector or persona will execute it (use only the ones provided; otherwise say 'pocket-agent').",
  "Return ONLY a single JSON object, no prose, matching exactly this shape:",
  '{"project": string, "definitionOfDone": string, "successCriteria": string[],',
  ' "milestones": [{"title": string, "definitionOfDone": string, "status": "planned",',
  '   "tasks": [{"title": string, "inputs": string, "expectedOutput": string, "executor": string, "status": "planned"}]}]}',
].join(" ");

function buildScaffoldPrompt(goal: string, ctx: PlannerContext): string {
  const connectors = ctx.availableConnectors.length
    ? ctx.availableConnectors.join(", ")
    : "(none connected — plan read-only or pocket-agent tasks)";
  const personas = ctx.availablePersonas.length
    ? ctx.availablePersonas.join(", ")
    : "(none)";
  return [
    `GOAL: ${goal}`,
    `AVAILABLE CONNECTORS: ${connectors}`,
    `AVAILABLE PERSONAS: ${personas}`,
    "Produce the plan as JSON only.",
  ].join("\n");
}

/** Extracts the first balanced JSON object from a model response (handles ```json fences). */
export function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return body.slice(start, i + 1);
    }
  }
  return null;
}

/** Parses + validates a model response into a Scaffold, or returns null if unusable. */
export function parseScaffold(text: string): Scaffold | null {
  const json = extractJsonObject(text);
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = ScaffoldSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** A safe single-milestone fallback plan when the LLM is unavailable or returns garbage. */
export function fallbackScaffold(goal: string): Scaffold {
  return {
    project: goal.slice(0, 500),
    definitionOfDone: "The owner's goal is completed and reviewed.",
    successCriteria: [],
    milestones: [
      {
        title: "Complete the goal",
        definitionOfDone: "The requested work is done and staged for approval.",
        status: "planned",
        tasks: [
          {
            title: goal.slice(0, 300),
            inputs: "The owner's request and connected context.",
            expectedOutput: "The completed work, staged for one-tap approval.",
            executor: "pocket-agent",
            status: "planned",
          },
        ],
      },
    ],
  };
}

/**
 * Builds a reviewable scaffold for a goal. Calls the injected LLM; on any failure or
 * unparseable output, returns the deterministic fallback so the dispatcher never blocks on
 * the planner. `usedFallback` lets the caller surface a "rough plan" note.
 */
export async function buildScaffold(
  goal: string,
  ctx: PlannerContext,
  llm: PlannerLlm,
): Promise<{ scaffold: Scaffold; usedFallback: boolean }> {
  let result: Awaited<ReturnType<PlannerLlm>>;
  try {
    result = await llm({
      system: SCAFFOLD_SYSTEM,
      user: buildScaffoldPrompt(goal, ctx),
    });
  } catch {
    return { scaffold: fallbackScaffold(goal), usedFallback: true };
  }
  if (!result.ok) return { scaffold: fallbackScaffold(goal), usedFallback: true };
  const scaffold = parseScaffold(result.text);
  if (!scaffold) return { scaffold: fallbackScaffold(goal), usedFallback: true };
  return { scaffold, usedFallback: false };
}

// ── Scaffold → artifacts ────────────────────────────────────────────────────────────────

/** Renders a scaffold as the markdown committed to scaffolds/<slug>/scaffolding.md. */
export function scaffoldToMarkdown(scaffold: Scaffold, stampIso: string): string {
  const lines: string[] = [];
  lines.push(`# Project: ${scaffold.project}`, "");
  lines.push(`> Generated ${stampIso} by Pocket Agent Scaffolder (PA-ORCH-13)`, "");
  if (scaffold.definitionOfDone) {
    lines.push(`**Definition of done:** ${scaffold.definitionOfDone}`, "");
  }
  if (scaffold.successCriteria.length) {
    lines.push("**Success criteria:**");
    for (const c of scaffold.successCriteria) lines.push(`- ${c}`);
    lines.push("");
  }
  scaffold.milestones.forEach((m, i) => {
    lines.push(`## Milestone ${i + 1}: ${m.title}  \`[${m.status}]\``);
    if (m.definitionOfDone) lines.push(`_Done when:_ ${m.definitionOfDone}`);
    lines.push("");
    m.tasks.forEach((t, j) => {
      lines.push(`- **${i + 1}.${j + 1} ${t.title}** \`[${t.status}]\` — _executor:_ ${t.executor || "pocket-agent"}`);
      if (t.inputs) lines.push(`  - Inputs: ${t.inputs}`);
      if (t.expectedOutput) lines.push(`  - Output: ${t.expectedOutput}`);
    });
    lines.push("");
  });
  return lines.join("\n");
}

/** Slugifies a project title for the scaffolds/<slug>/ brain path. */
export function projectSlug(project: string): string {
  const base = project
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "project";
}

/**
 * Derives a per-leaf sub-agent spec (the ISA) from a scaffold task. The dispatcher fires one
 * sub-agent per leaf with this spec; ContainmentGuard enforces toolScopes on the action path.
 */
export function specForTask(
  scaffold: Scaffold,
  milestoneIndex: number,
  taskIndex: number,
  toolScopes: string[],
  readZones: string[],
): SubAgentSpec {
  const milestone = scaffold.milestones[milestoneIndex];
  const task = milestone.tasks[taskIndex];
  return {
    objective: task.title,
    toolScopes,
    readZones,
    definitionOfDone: task.expectedOutput || milestone.definitionOfDone,
    context: {
      project: scaffold.project,
      milestone: milestone.title,
      milestoneIndex,
      taskIndex,
      inputs: task.inputs,
      executor: task.executor,
    },
  };
}

export { estimateAgentMinutes };
