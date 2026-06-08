// verification.ts — the advisory second-opinion gate (PA-MC-7).
//
// After a sub-agent run completes, a second pass asks "did this actually meet its definition of
// done?" BEFORE Mission Control honours the completion. v1 is ADVISORY: the verdict is logged to
// pa_verification_log and surfaced on the run, but it never blocks — a 'fail' does not undo a
// 'done'. v2 (future, PA-MC-7) flips this to enforcement (a fail re-opens the run for retry).
//
// The v1 check is deliberately deterministic, not an LLM call: it costs nothing, can't itself
// hallucinate a pass, and gives the owner an honest signal ("the agent said done but left no
// evidence") without a model dependency. The honest framing on the surface is "advisory" — we do
// not claim the work was independently re-executed. The 2+-strike rule (a run that fails the gate
// twice) parks it in Attention with needs_human, which is where a human, not the machine, decides.

import {
  SubAgentSpecSchema,
  type RunStatus,
  type SubAgentRunRow,
  type VerificationVerdict,
} from "./types";
import {
  countVerificationFailures,
  insertVerificationLog,
  updateRun,
} from "./db";

export type VerificationOutcome = {
  verdict: VerificationVerdict;
  reason: string;
  /** True once this run has failed the gate 2+ times — flips needs_human and parks it. */
  needsHuman: boolean;
};

/** Minimum result-summary length we accept as evidence a definition-of-done was met. */
const MIN_EVIDENCE_CHARS = 24;

/**
 * Pure advisory verdict for one completion. No I/O — unit-tested in isolation. `status` is the
 * run's terminal status as reported by the runtime; `resultSummary` is what it claims it did.
 */
export function advisoryVerdict(
  run: Pick<SubAgentRunRow, "spec_json">,
  completion: { status: RunStatus; resultSummary: string | null },
): { verdict: VerificationVerdict; reason: string } {
  const summary = (completion.resultSummary ?? "").trim();

  if (completion.status === "failed" || completion.status === "canceled") {
    return {
      verdict: "fail",
      reason: `Run ended ${completion.status} without completing its objective.`,
    };
  }

  if (!summary) {
    return {
      verdict: "abstain",
      reason: "Run reported done but left no result summary to verify against the definition of done.",
    };
  }

  const spec = SubAgentSpecSchema.safeParse(run.spec_json);
  const definitionOfDone = spec.success ? spec.data.definitionOfDone.trim() : "";

  if (definitionOfDone && summary.length < MIN_EVIDENCE_CHARS) {
    return {
      verdict: "abstain",
      reason: "Result summary is too thin to confirm the definition of done was met.",
    };
  }

  return definitionOfDone
    ? { verdict: "pass", reason: "Result summary is substantive against the stated definition of done." }
    : {
        verdict: "pass",
        reason: "No explicit definition of done; accepting the run's own completion report (advisory).",
      };
}

/**
 * Run the gate for a just-completed run: compute the verdict, log it, and — if the run has now
 * failed the gate 2+ times — flip needs_human so Mission Control parks it in Attention. Records
 * the latest verdict on the run either way. ADVISORY: returns the outcome but never changes the
 * run's completion status. Throws on a DB error (no silent catch); the webhook decides whether a
 * gate failure should fail the whole callback (it does not — the run already completed).
 */
export async function applyVerificationGate(
  run: SubAgentRunRow,
  completion: { status: RunStatus; resultSummary: string | null },
): Promise<VerificationOutcome> {
  const { verdict, reason } = advisoryVerdict(run, completion);
  await insertVerificationLog({ subAgentRunId: run.id, verdict, reason });

  const failures = verdict === "fail" ? await countVerificationFailures(run.id) : 0;
  const needsHuman = failures >= 2;

  await updateRun(run.id, {
    verificationVerdict: verdict,
    ...(needsHuman ? { needsHuman: true } : {}),
  });

  return { verdict, reason, needsHuman };
}
