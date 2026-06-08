// POST /api/orchestrator/webhook
// The Modal runtime → PA callback. Authenticated by the shared runtime token. Drives the
// durable run record forward through the 7-phase Algorithm, stages connector write-actions for
// approval (ContainmentGuard-checked), and reconciles agent-minutes on completion.
//
// Idempotency: phase/action events are append-only or best-effort; run_complete is the only
// metered write and reconciles against the run's reserved estimate exactly once (we no-op when
// the run is already terminal).

import {
  fetchRun,
  logPhaseComplete,
  logPhaseEnter,
  markConnectorActionStatusByRun,
  reconcileAgentMinutes,
  touchHeartbeat,
  updateRun,
} from "@/lib/orchestrator/db";
import { resolveInboxItem } from "@/lib/pa-inbox-items";
import { stageConnectorAction } from "@/lib/orchestrator/tool-use";
import { executeConnectorAction } from "@/lib/connectors/registry";
import { notifyApprovalNeeded } from "@/lib/connectors/system";
import { ConnectorScopeError } from "@/lib/orchestrator/containment-guard";
import { verifyWebhookSecret } from "@/lib/orchestrator/runtime-client";
import { applyVerificationGate } from "@/lib/orchestrator/verification";
import { monthKey } from "@/lib/orchestrator/tier-caps";
import { WebhookEventSchema, isTerminalStatus } from "@/lib/orchestrator/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readToken(req: Request): string | null {
  const header = req.headers.get("x-pa-runtime-token");
  if (header) return header;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!verifyWebhookSecret(readToken(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: z.infer<typeof WebhookEventSchema>;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    event = WebhookEventSchema.parse(raw);
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid event" : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const run = await fetchRun(event.runId);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  // Heartbeat: any event from the runtime proves the run is alive, so stamp it before handling.
  // Best-effort — a heartbeat write must never fail the callback, but the miss is logged (not
  // swallowed) so a systemic heartbeat failure is visible rather than silently zombifying runs.
  try {
    await touchHeartbeat(run.id, new Date().toISOString());
  } catch (e) {
    console.error("[orchestrator/webhook] heartbeat stamp failed", {
      runId: run.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  switch (event.type) {
    case "phase_enter": {
      await logPhaseEnter(run.id, event.phase, event.note);
      await updateRun(run.id, {
        status: run.status === "planning" ? "running" : run.status,
        phaseProgress: { currentPhase: event.phase, note: event.note ?? null },
      });
      return NextResponse.json({ ok: true });
    }

    case "phase_complete": {
      await logPhaseComplete(run.id, event.phase, event.durationMs);
      return NextResponse.json({ ok: true });
    }

    case "action_staged": {
      // ContainmentGuard (action path) runs INSIDE stageConnectorAction — fail closed.
      try {
        const staged = await stageConnectorAction({
          userId: run.business_id,
          subAgentRunId: run.id,
          connector: event.connector,
          action: event.action,
          payload: event.payload,
          declaredScopes: run.tool_scopes,
          title: `${event.connector} · ${event.action}`,
          preview: event.preview ?? "",
        });

        // Auto-approve (trust ladder unlocked): an in-process connector must FIRE here, or the
        // staged item would sit forever with no manual tap coming. A failed auto-execute leaves
        // the item pending so the owner can still approve/retry. Remote connectors (exec
        // undefined) resume via the runtime, unchanged.
        let executed: boolean | undefined;
        if (staged.autoApproved) {
          const exec = await executeConnectorAction({
            connector: event.connector,
            userId: run.business_id,
            action: event.action,
            payload: event.payload,
            subAgentRunId: run.id,
          });
          if (exec) {
            executed = exec.ok;
            if (exec.ok) {
              await resolveInboxItem(staged.inboxItemId, "approved", run.business_id);
              await markConnectorActionStatusByRun({
                runId: run.id,
                connector: event.connector,
                action: event.action,
                status: "executed",
              }).catch(() => undefined);
            }
          }
        }

        // Approval-needed ping: only when a manual tap is actually coming (not auto-approved).
        // Best-effort + idempotent (approval_needed:<inboxItemId>) — the Inbox card is the durable
        // signal; the email nudges the owner who is out of the app.
        if (!staged.autoApproved) {
          const notice = await notifyApprovalNeeded({
            userId: run.business_id,
            connector: event.connector,
            action: event.action,
            preview: event.preview ?? "",
            inboxItemId: staged.inboxItemId,
          });
          if (!notice.ok) {
            console.error("[orchestrator/webhook] approval ping failed", {
              userId: run.business_id,
              inboxItemId: staged.inboxItemId,
              status: notice.status,
              error: notice.error,
            });
          }
        }

        return NextResponse.json({
          ok: true,
          approvalId: staged.actionApprovalId,
          inboxItemId: staged.inboxItemId,
          autoApproved: staged.autoApproved,
          executed,
        });
      } catch (e) {
        if (e instanceof ConnectorScopeError) {
          // Out-of-scope: tell the runtime so it surfaces the scope-request message, not a crash.
          return NextResponse.json(
            { ok: false, blocked: "out_of_scope", connector: e.connector, action: e.action },
            { status: 200 },
          );
        }
        throw e;
      }
    }

    case "run_complete": {
      if (isTerminalStatus(run.status)) {
        return NextResponse.json({ ok: true, alreadyTerminal: true });
      }
      const cost = event.tokenCost ?? 0;
      await updateRun(run.id, {
        status: event.status,
        resultSummary: event.resultSummary ?? null,
        agentMinutes: event.agentMinutes,
        tokenCost: cost,
      });
      // Swap the reserved estimate for the measured actual against the monthly meter.
      await reconcileAgentMinutes({
        businessId: run.business_id,
        month: monthKey(),
        reserved: run.agent_minutes,
        actual: event.agentMinutes,
        cost,
      });

      // Advisory verification gate (PA-MC-7): log a second-opinion verdict before Mission Control
      // honours the completion. v1 never blocks — a failure only records the verdict and, on a
      // 2+-strike, parks the run in Attention. A gate error must not fail the (already-completed)
      // callback, so it's caught + logged, not swallowed.
      let verification: { verdict: string; needsHuman: boolean } | undefined;
      try {
        const outcome = await applyVerificationGate(
          { ...run, status: event.status },
          { status: event.status, resultSummary: event.resultSummary ?? null },
        );
        verification = { verdict: outcome.verdict, needsHuman: outcome.needsHuman };
      } catch (e) {
        console.error("[orchestrator/webhook] verification gate failed", {
          runId: run.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      return NextResponse.json({ ok: true, verification });
    }
  }
}
