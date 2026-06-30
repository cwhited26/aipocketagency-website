// POST /api/orchestrator/approvals/<inboxItemId>  { decision: "approve"|"reject"|"edit", payload? }
// One-tap resolution of a staged connector write-action (SPEC §9.4). `id` is the pa_inbox_items
// row id (what the chat card + Inbox queue key on). Approve fires the runtime's blocked tool
// call (best-effort) and bumps the (connector, action) trust window; reject aborts it; edit
// rewrites the payload and keeps it pending.
//
// Ownership is enforced in code: the inbox item's user_id must equal the caller.

import { createClient } from "@/lib/supabase/server";
import { fetchInboxItemById, resolveInboxItem } from "@/lib/pa-inbox-items";
import {
  fetchActionApprovalByInboxItem,
  markConnectorActionStatusByRun,
  recordAutoApproveSuccess,
  updateActionApprovalPayload,
} from "@/lib/orchestrator/db";
import { notifyApproval } from "@/lib/orchestrator/runtime-client";
import { autoApproveUnlockedFor } from "@/lib/orchestrator/tier-caps";
import { executeConnectorAction } from "@/lib/connectors/registry";
import {
  advanceLandingPageBuildAfterApproval,
  failLandingPageBuildAfterRejection,
  type AdvanceResult,
} from "@/lib/landing-pages/advance";
import { advanceIdeaBuildAfterApproval, ideaBuildIdOf } from "@/lib/idea-engine/build";
import { fetchPaUser } from "@/lib/pa-supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

/** The landing_page_id a build step's stored payload carries, when it belongs to a Landing Page build. */
function landingPageIdOf(payload: Record<string, unknown>): string | null {
  const v = payload.landing_page_id;
  return typeof v === "string" && v ? v : null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  decision: z.enum(["approve", "reject", "edit"]),
  // Required for "edit": the revised action payload.
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
  // Productivity (action_approval), build (build_action_approval), and browser (browser_action_approval)
  // connector actions all resolve here — same pa_action_approvals detail row, same executeConnectorAction
  // dispatch.
  const isConnectorApproval =
    item?.kind === "action_approval" ||
    item?.kind === "build_action_approval" ||
    item?.kind === "browser_action_approval";
  if (!item || item.user_id !== user.id || !isConnectorApproval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }
  if (item.status !== "pending") {
    return NextResponse.json({ error: `Already ${item.status}` }, { status: 409 });
  }

  const approval = await fetchActionApprovalByInboxItem(item.id);
  if (!approval) {
    return NextResponse.json({ error: "Approval detail missing" }, { status: 404 });
  }

  // ── edit: rewrite the payload, stay pending ──────────────────────────────────────────
  if (body.decision === "edit") {
    if (!body.payload) {
      return NextResponse.json({ error: "edit requires a payload" }, { status: 400 });
    }
    await updateActionApprovalPayload(approval.id, body.payload);
    return NextResponse.json({ status: "pending", edited: true });
  }

  // ── approve / reject ─────────────────────────────────────────────────────────────────
  if (body.decision === "approve") {
    // In-process connectors (Slack) execute here, server-side, BEFORE the item is marked
    // approved — so a failed send leaves the item pending for retry rather than reporting a
    // success that never happened. Remote connectors return undefined and resume via the
    // runtime notify below.
    const exec = await executeConnectorAction({
      connector: approval.connector,
      userId: user.id,
      action: approval.action,
      payload: approval.payload,
      subAgentRunId: approval.sub_agent_run_id,
      ownerEmail: user.email ?? null,
      // Deterministic idempotency seed for financial writes (QuickBooks Request-Id) — a retry
      // of the same approval can't double-post an invoice or payment.
      requestId: approval.id,
    });
    if (exec && !exec.ok) {
      return NextResponse.json({ error: exec.error }, { status: exec.status });
    }

    await resolveInboxItem(item.id, "approved", user.id);
    await markConnectorActionStatusByRun({
      runId: approval.sub_agent_run_id ?? "",
      connector: approval.connector,
      action: approval.action,
      status: exec ? "executed" : "approved",
    }).catch(() => undefined);
    const trustCount = await recordAutoApproveSuccess(
      user.id,
      approval.connector,
      approval.action,
    );
    // Only signal the runtime for remote connectors; in-process ones already executed.
    if (!exec && approval.sub_agent_run_id) {
      await notifyApproval({
        runId: approval.sub_agent_run_id,
        approvalId: approval.id,
        decision: "approved",
        payload: approval.payload,
      });
    }

    // Landing Page Builder: when an approved build step belongs to a landing page build, advance the
    // build (record the artifact, stage the next step). Best-effort — the connector action already
    // ran, so a hiccup here is surfaced in the response (landingBuild), never undoes the real success.
    let landingBuild: AdvanceResult | undefined;
    const landingPageId =
      item.kind === "build_action_approval" ? landingPageIdOf(approval.payload) : null;
    if (landingPageId && exec && exec.ok) {
      try {
        landingBuild = await advanceLandingPageBuildAfterApproval({
          landingPageId,
          ownerId: user.id,
          action: approval.action,
          data: exec.data,
        });
      } catch (e) {
        landingBuild = { ok: false, status: 500, error: e instanceof Error ? e.message : "advance failed" };
      }
    }

    // Idea Engine auto-build (PA-IDEA-2): an approved build step tagged with idea_id advances that
    // idea's MVP / sales build (record the artifact, stage the next step, or finish + write the
    // Snapshot). Same one-step-per-approval shape as the Landing Page Builder. Best-effort.
    let ideaBuild: AdvanceResult | undefined;
    const ideaId = item.kind === "build_action_approval" ? ideaBuildIdOf(approval.payload) : null;
    if (ideaId && !landingPageId && exec && exec.ok) {
      try {
        const pa = await fetchPaUser(user.id);
        const brain =
          pa.ok && pa.data && pa.data.brain_repo && pa.data.github_token
            ? { repo: pa.data.brain_repo, token: pa.data.github_token }
            : null;
        const adv = await advanceIdeaBuildAfterApproval({
          approvalPayload: approval.payload,
          ownerId: user.id,
          action: approval.action,
          data: exec.data,
          brain,
        });
        ideaBuild = adv.ok
          ? { ok: true, staged: !("done" in adv) }
          : { ok: false, status: adv.status, error: adv.error };
      } catch (e) {
        ideaBuild = { ok: false, status: 500, error: e instanceof Error ? e.message : "advance failed" };
      }
    }

    return NextResponse.json({
      status: "approved",
      trustCount,
      autoApproveUnlocked: autoApproveUnlockedFor(approval.connector, approval.action, trustCount),
      connector: approval.connector,
      action: approval.action,
      executed: exec ? exec.ok : false,
      result: exec && exec.ok ? exec.summary : undefined,
      landingBuild,
      ideaBuild,
    });
  }

  // reject
  await resolveInboxItem(item.id, "rejected", user.id);
  await markConnectorActionStatusByRun({
    runId: approval.sub_agent_run_id ?? "",
    connector: approval.connector,
    action: approval.action,
    status: "rejected",
  }).catch(() => undefined);
  if (approval.sub_agent_run_id) {
    await notifyApproval({
      runId: approval.sub_agent_run_id,
      approvalId: approval.id,
      decision: "rejected",
    });
  }

  // A rejected build step ends a landing page build (the owner can retry from the App surface).
  let landingBuild: AdvanceResult | undefined;
  const rejectedLandingPageId =
    item.kind === "build_action_approval" ? landingPageIdOf(approval.payload) : null;
  if (rejectedLandingPageId) {
    try {
      landingBuild = await failLandingPageBuildAfterRejection({
        landingPageId: rejectedLandingPageId,
        ownerId: user.id,
      });
    } catch (e) {
      landingBuild = { ok: false, status: 500, error: e instanceof Error ? e.message : "fail-stop failed" };
    }
  }

  return NextResponse.json({ status: "rejected", landingBuild });
}
