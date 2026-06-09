// card.ts — stages the gate_findings Inbox card when a plan is flagged or blocked (SPEC §9,
// PA-GATE-9). The full finding rows live in pa_gate_findings (the audit trail); the card payload
// carries a compact, self-contained summary so the Mission Control card + the resolution route
// render without a second DB read. Every gate result is included — passed gates too — because
// transparency is the point (Principle 7): the owner learns to trust the gates by watching them work.

import { createInboxItem } from "@/lib/pa-inbox-items";
import { GATE_REGISTRY } from "./registry";
import type { GatePhaseResult } from "./schema";
import type { Scaffold } from "../types";

// The compact per-gate summary embedded in the card payload (and read back by the resolution route).
export type GateCardEntry = {
  name: string;
  label: string;
  status: "pass" | "flag" | "hard_fail" | "error";
  finding: GatePhaseResult["results"][number]["finding"];
  // Whether the owner may "Approve anyway" this gate's flag (per-gate trust window cleared).
  overridable: boolean;
};

export type GateCardPayload = {
  projectId: string;
  planVersion: number;
  projectTitle: string;
  verdict: "flagged" | "blocked";
  gates: GateCardEntry[];
};

function summaryLine(phase: GatePhaseResult): string {
  const total = phase.results.length;
  const passed = phase.results.filter((r) => r.status === "pass").length;
  const flagged = phase.results.filter((r) => r.status === "flag").length;
  const blocked = phase.results.filter((r) => r.status === "hard_fail" || r.status === "error").length;
  const parts: string[] = [`${passed} of ${total} gates passed.`];
  if (blocked > 0) parts.push(`${blocked} blocked this plan.`);
  if (flagged > 0) parts.push(`${flagged} flag${flagged === 1 ? "" : "s"} waiting on you.`);
  return parts.join(" ");
}

function bodyMarkdown(phase: GatePhaseResult, projectTitle: string): string {
  const lines: string[] = [`**${projectTitle}** — plan v${phase.planVersion}`, "", summaryLine(phase), ""];
  for (const r of phase.results) {
    const label = GATE_REGISTRY[r.gateName].label;
    if (r.status === "pass") {
      lines.push(`- ✅ ${label}`);
      continue;
    }
    const icon = r.status === "flag" ? "🚩" : "⛔";
    const f = r.finding;
    lines.push(`- ${icon} **${label}** — ${r.status.replace("_", " ")}`);
    if (f) {
      lines.push(`  - Rule: ${f.rule_violated} (${f.rule_source})`);
      lines.push(`  - Where: ${f.plan_task_violating}`);
      lines.push(`  - Fix: ${f.suggested_fix}`);
    }
  }
  return lines.join("\n");
}

/**
 * Stages one gate_findings card for a held plan. Returns the inbox-item id (the key the chat card +
 * resolution route use). Throws on a DB failure — a held plan that can't surface a card must not be
 * silently dropped.
 */
export async function stageGateFindingsCard(input: {
  businessId: string;
  projectId: string;
  scaffold: Scaffold;
  phase: GatePhaseResult;
}): Promise<string> {
  const verdict = input.phase.verdict === "blocked" ? "blocked" : "flagged";
  const payload: GateCardPayload = {
    projectId: input.projectId,
    planVersion: input.phase.planVersion,
    projectTitle: input.scaffold.project,
    verdict,
    gates: input.phase.results.map((r) => ({
      name: r.gateName,
      label: GATE_REGISTRY[r.gateName].label,
      status: r.status,
      finding: r.finding,
      overridable: r.overridable,
    })),
  };

  const res = await createInboxItem({
    userId: input.businessId,
    kind: "gate_findings",
    title: `Gate Findings — "${input.scaffold.project}"`,
    bodyMd: bodyMarkdown(input.phase, input.scaffold.project),
    source: "gate",
    payload: payload as unknown as Record<string, unknown>,
  });
  if (!res.ok) throw new Error(`Could not stage gate_findings card: ${res.error}`);
  return res.data.id;
}
