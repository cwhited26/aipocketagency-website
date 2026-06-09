// customer-name.ts — the Customer Name Gate (PA-GATE-2, SPEC §10 gate 2).
//
// Scans the plan's external-facing copy for real customer names sourced from the brain's protected-
// names list (memory/customer_names_protected.md). Deterministic by design — a string-scan against
// a maintained list is more robust and faster than asking an LLM "is this a real name", and a
// name-leak into a published landing page is exactly the kind of safety check that should not depend
// on model judgment. Internal references ("pull Patrick's job file") are NOT flagged; only copy that
// ships to the public (externalCopyTasks) is in scope.

import type { GateVerdict } from "./schema";
import type { GateContext, GateRun } from "./types";
import { GateAuditError } from "./llm-audit";
import { externalCopyTasks } from "./plan-render";

const PROTECTED_FILE = "memory/customer_names_protected.md";

/**
 * Parses the protected-names list out of the rule-file. Names live as `- ` bullets under the
 * "## Protected names" heading (one name per bullet, text before any `—`/`(`). Returns:
 *  - { names } on a well-formed section (possibly empty — a brand-new brain with no clients yet),
 *  - null when the section heading is absent → the file is malformed and the gate fails closed.
 */
export function parseProtectedNames(content: string): { names: string[] } | null {
  const lines = content.split(/\r?\n/);
  const headingIdx = lines.findIndex((l) => /^#{1,6}\s+protected names\s*$/i.test(l.trim()));
  if (headingIdx === -1) return null;

  const names: string[] = [];
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^#{1,6}\s+/.test(line)) break; // next heading ends the section
    const m = line.match(/^[-*]\s+(.+)$/);
    if (!m) continue;
    // Drop any trailing annotation after an em/en dash or a parenthetical.
    const name = m[1].split(/\s+[—–-]\s+|\s+\(/)[0].trim();
    if (name) names.push(name);
  }
  return { names };
}

/** Escapes a name for use inside a whole-word, case-insensitive RegExp. */
function nameToRegex(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // \b on the outer edges; works for "Alan Stoll" and bare "Patrick" alike.
  return new RegExp(`\\b${escaped}\\b`, "i");
}

export const runCustomerNameGate: GateRun = async (ctx: GateContext): Promise<GateVerdict> => {
  const content = ctx.ruleFiles.get(PROTECTED_FILE);
  // The runner only invokes run() when the required file was readable, but guard anyway — a
  // missing/empty protected list is a fail-closed condition for a safety gate, not a silent pass.
  if (!content || !content.trim()) {
    throw new GateAuditError("malformed_output", `${PROTECTED_FILE} is empty or unreadable`);
  }
  const parsed = parseProtectedNames(content);
  if (!parsed) {
    throw new GateAuditError(
      "malformed_output",
      `${PROTECTED_FILE} has no "## Protected names" section to read`,
    );
  }
  // A legitimately empty list (a brand-new brain) → nothing to protect yet → pass.
  if (parsed.names.length === 0) {
    return { status: "pass", finding: null };
  }

  const matchers = parsed.names.map((n) => ({ name: n, re: nameToRegex(n) }));
  for (const task of externalCopyTasks(ctx.scaffold)) {
    const hits = matchers.filter((m) => m.re.test(task.text));
    if (hits.length === 0) continue;
    const names = [...new Set(hits.map((h) => h.name))];
    return {
      status: "flag",
      finding: {
        rule_violated:
          "Real customer names never appear in external, public-facing product copy — use an anonymized pattern.",
        rule_source: `${PROTECTED_FILE} (## Protected names)`,
        plan_task_violating: `${task.ref} — ${task.title}`,
        severity: "high",
        suggested_fix:
          `Swap ${names.join(", ")} for the anonymized testimony pattern (e.g. "a Tennessee roofing ` +
          `contractor") — keep the outcome, drop the name.`,
        evidence: `Protected name(s) ${names.join(", ")} appear in this public-facing task: "${task.text.slice(0, 300)}"`,
      },
    };
  }
  return { status: "pass", finding: null };
};
