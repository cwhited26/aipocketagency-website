// POST /api/connections/calendar/approve/<inboxItemId>  { decision, payload? }
// The "fires on approve" path for a staged Calendar write-action (task item 5). `id` is the
// pa_inbox_items row id. A Calendar action is a TypeScript + direct-REST connector, so it runs
// in-process here the moment the owner approves — no Modal sub-agent makes the Calendar call.
//
// Approve runs the real Calendar action BEFORE the item is marked approved: a failed call leaves
// the item pending for retry/reconnect rather than reporting a success that never happened.
// Reject aborts it; edit rewrites the payload and keeps it pending. read/draft Calendar actions
// (list_events, propose_times) never stage here — only the gated writes do.
//
// Calendar-scoped on purpose: it 400s any non-calendar approval so other connectors keep using
// the generic /api/orchestrator/approvals route.

import { createClient } from "@/lib/supabase/server";
import { fetchInboxItemById, resolveInboxItem } from "@/lib/pa-inbox-items";
import {
  fetchActionApprovalByInboxItem,
  markConnectorActionStatusByRun,
  recordAutoApproveSuccess,
  updateActionApprovalPayload,
} from "@/lib/orchestrator/db";
import { autoApproveUnlocked } from "@/lib/orchestrator/tier-caps";
import { runCalendarAction, isCalendarAction } from "@/lib/connectors/calendar";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  decision: z.enum(["approve", "reject", "edit"]),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    body = BodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const inboxRes = await fetchInboxItemById(params.id);
  if (!inboxRes.ok) return NextResponse.json({ error: inboxRes.error }, { status: inboxRes.status });
  const item = inboxRes.data;
  if (!item || item.user_id !== user.id || item.kind !== "action_approval") {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }
  if (item.status !== "pending") {
    return NextResponse.json({ error: `Already ${item.status}` }, { status: 409 });
  }

  const approval = await fetchActionApprovalByInboxItem(item.id);
  if (!approval) {
    return NextResponse.json({ error: "Approval detail missing" }, { status: 404 });
  }
  if (approval.connector !== "calendar" || !isCalendarAction(approval.action)) {
    return NextResponse.json(
      { error: "Not a Calendar approval — use the standard approvals route." },
      { status: 400 },
    );
  }

  // ── edit: rewrite the payload, stay pending ──────────────────────────────────────────
  if (body.decision === "edit") {
    if (!body.payload) {
      return NextResponse.json({ error: "edit requires a payload" }, { status: 400 });
    }
    await updateActionApprovalPayload(approval.id, body.payload);
    return NextResponse.json({ status: "pending", edited: true });
  }

  // ── reject ───────────────────────────────────────────────────────────────────────────
  if (body.decision === "reject") {
    await resolveInboxItem(item.id, "rejected", user.id);
    await markConnectorActionStatusByRun({
      runId: approval.sub_agent_run_id ?? "",
      connector: approval.connector,
      action: approval.action,
      status: "rejected",
    }).catch(() => undefined);
    return NextResponse.json({ status: "rejected" });
  }

  // ── approve: execute the Calendar action, THEN resolve ────────────────────────────────
  const run = await runCalendarAction({
    userId: user.id,
    action: approval.action,
    payload: approval.payload,
    requestId: approval.id, // deterministic idempotency seed (e.g. Meet createRequest)
  });
  if (!run.ok) {
    await markConnectorActionStatusByRun({
      runId: approval.sub_agent_run_id ?? "",
      connector: approval.connector,
      action: approval.action,
      status: "failed",
    }).catch(() => undefined);
    // Leave the item pending so the owner can retry or reconnect — nothing was scheduled.
    return NextResponse.json({ error: run.error, reauth: run.reauth }, { status: run.status });
  }

  await resolveInboxItem(item.id, "approved", user.id);
  await markConnectorActionStatusByRun({
    runId: approval.sub_agent_run_id ?? "",
    connector: approval.connector,
    action: approval.action,
    status: "executed",
  }).catch(() => undefined);
  const trustCount = await recordAutoApproveSuccess(user.id, approval.connector, approval.action);

  return NextResponse.json({
    status: "approved",
    executed: true,
    result: run.summary,
    trustCount,
    autoApproveUnlocked: autoApproveUnlocked(trustCount),
    connector: approval.connector,
    action: approval.action,
  });
}
