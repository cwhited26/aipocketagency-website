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
  reconcileAgentMinutes,
  updateRun,
} from "@/lib/orchestrator/db";
import { stageConnectorAction } from "@/lib/orchestrator/tool-use";
import { ConnectorScopeError } from "@/lib/orchestrator/containment-guard";
import { verifyWebhookSecret } from "@/lib/orchestrator/runtime-client";
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
        return NextResponse.json({
          ok: true,
          approvalId: staged.actionApprovalId,
          inboxItemId: staged.inboxItemId,
          autoApproved: staged.autoApproved,
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
      return NextResponse.json({ ok: true });
    }
  }
}
