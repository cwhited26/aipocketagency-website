// plan-render.ts — turns an approved Scaffold into the text a gate audits, plus the small
// classifiers the gates share (which tasks produce external copy, whether the plan touches code).
//
// One renderer, one set of classifiers — so the Voice Gate and the Customer Name Gate agree on
// what "external-facing copy" is, and the Code Convention and Test gates agree on what "involves
// code" is. Pure functions, fully unit-tested.

import type { Scaffold } from "../types";

// A single plan leaf, flattened with a stable human reference for findings.
export type TaskRef = {
  // "Milestone 2 · Task 7" — what a finding's plan_task_violating points at.
  ref: string;
  milestoneIndex: number; // 0-based
  taskIndex: number; // 0-based
  title: string;
  inputs: string;
  expectedOutput: string;
  executor: string;
  // The concatenated text of the task (title + inputs + output) for scanning.
  text: string;
};

export function flattenTasks(scaffold: Scaffold): TaskRef[] {
  const out: TaskRef[] = [];
  scaffold.milestones.forEach((m, mi) => {
    m.tasks.forEach((t, ti) => {
      out.push({
        ref: `Milestone ${mi + 1} · Task ${ti + 1}`,
        milestoneIndex: mi,
        taskIndex: ti,
        title: t.title,
        inputs: t.inputs,
        expectedOutput: t.expectedOutput,
        executor: t.executor,
        text: [t.title, t.inputs, t.expectedOutput].filter(Boolean).join(" \n "),
      });
    });
  });
  return out;
}

// Words that mark a task as producing copy that ships to the public — what the Voice + Customer
// Name gates scope to. External copy is the surface a banned phrase or a real name actually leaks on.
const EXTERNAL_COPY_MARKERS = [
  "email",
  "drip",
  "newsletter",
  "landing",
  "page",
  "website",
  "web page",
  "post",
  "social",
  "tweet",
  "linkedin",
  "instagram",
  "facebook",
  "caption",
  "blog",
  "article",
  "copy",
  "headline",
  "ad ",
  "ad copy",
  "advert",
  "campaign",
  "outreach",
  "script",
  "video",
  "sms",
  "text message",
  "message",
  "publish",
  "announce",
  "press",
];

/** True when a task's text reads like it produces public-facing copy. */
export function producesExternalCopy(task: TaskRef): boolean {
  const hay = task.text.toLowerCase();
  return EXTERNAL_COPY_MARKERS.some((m) => hay.includes(m));
}

/** The plan tasks that produce external-facing copy (Voice + Customer Name scope). */
export function externalCopyTasks(scaffold: Scaffold): TaskRef[] {
  return flattenTasks(scaffold).filter(producesExternalCopy);
}

// Words that mark a plan as building or editing code — gates the code-only gates (SPEC §10 gates 4, 6).
const CODE_MARKERS = [
  "crm",
  "dashboard",
  "website",
  "web app",
  "webapp",
  " app",
  "app ",
  "code",
  "api",
  "endpoint",
  "migration",
  "database",
  "schema",
  "deploy",
  "repo",
  "repository",
  "component",
  "frontend",
  "backend",
  "function",
  "integration",
  "automation",
  "build a",
  "build the",
  "supabase",
  "vercel",
  "github",
  "next.js",
  "react",
  "typescript",
];

/** True when the plan involves writing/editing code (CRM, website, automation, dashboard, …). */
export function planInvolvesCode(scaffold: Scaffold): boolean {
  const hay = [
    scaffold.project,
    scaffold.definitionOfDone,
    ...scaffold.successCriteria,
    ...flattenTasks(scaffold).map((t) => `${t.text} ${t.executor}`),
  ]
    .join(" \n ")
    .toLowerCase();
  return CODE_MARKERS.some((m) => hay.includes(m));
}

/** Renders the plan as the compact text block an LLM gate reads. */
export function renderPlanForAudit(goal: string, scaffold: Scaffold): string {
  const lines: string[] = [];
  lines.push(`OWNER GOAL: ${goal}`, "");
  lines.push(`PROJECT: ${scaffold.project}`);
  if (scaffold.definitionOfDone) lines.push(`DEFINITION OF DONE: ${scaffold.definitionOfDone}`);
  if (scaffold.successCriteria.length) {
    lines.push(`SUCCESS CRITERIA: ${scaffold.successCriteria.join("; ")}`);
  }
  lines.push("");
  scaffold.milestones.forEach((m, mi) => {
    lines.push(`MILESTONE ${mi + 1}: ${m.title}`);
    if (m.definitionOfDone) lines.push(`  done when: ${m.definitionOfDone}`);
    m.tasks.forEach((t, ti) => {
      lines.push(`  Task ${ti + 1}: ${t.title}`);
      if (t.inputs) lines.push(`    inputs: ${t.inputs}`);
      if (t.expectedOutput) lines.push(`    output: ${t.expectedOutput}`);
      lines.push(`    executor: ${t.executor || "pocket-agent"}`);
    });
    lines.push("");
  });
  return lines.join("\n");
}

/** The distinct executors a plan names (lowercased), excluding the pocket-agent default. */
export function planExecutors(scaffold: Scaffold): string[] {
  const set = new Set<string>();
  for (const t of flattenTasks(scaffold)) {
    const ex = t.executor.trim().toLowerCase();
    if (!ex || ex === "pocket-agent" || ex === "pocket agent") continue;
    set.add(ex);
  }
  return [...set];
}
