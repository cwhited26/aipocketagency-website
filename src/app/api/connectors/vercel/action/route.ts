// POST /api/connectors/vercel/action  { action, payload }
// The internal action route for the Vercel build connector. One owner-initiated entry point that:
//   • runs a READ action (getDeploymentStatus) inline and returns the result, and
//   • stages a GATED action (createProject / setEnvVar / triggerDeploy / attachDomain) to the
//     Approval Inbox as a 'build_action_approval' card — the owner approves it in the Inbox, which
//     dispatches back through /api/orchestrator/approvals/[id] → the registry → the Vercel executor.
//
// When the owner has unlocked + enabled auto-approve for the (vercel, action) pair, the staged
// action fires immediately here (same execute path the approval route uses) — except attach_domain,
// which is single-approval forever (tier-caps Infinity window) and can never be auto-approved.
//
// declaredScopes is ['vercel'] because the OWNER is initiating the action directly. The scope gate
// (ContainmentGuard) exists to fence sub-agents; an owner acting on their own connection is in scope.

import { createClient } from "@/lib/supabase/server";
import { isVercelAction, isVercelReadOnly } from "@/lib/connectors/vercel/index";
import type { VercelActionName } from "@/lib/connectors/vercel/types";
import { executeVercelConnectorAction } from "@/lib/connectors/vercel/execute";
import { stageConnectorAction, ConnectorScopeError } from "@/lib/orchestrator/tool-use";
import { resolveInboxItem } from "@/lib/pa-inbox-items";
import { recordAutoApproveSuccess } from "@/lib/orchestrator/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.string().min(1).max(60),
  payload: z.record(z.string(), z.unknown()).default({}),
});

// One-line card title + a longer preview, per action, for the build_action_approval card. The
// payload is owner-supplied, already shape-checked by the action's own schema on execute; here we
// only read it for display, defaulting missing fields rather than failing the preview.
function describe(action: VercelActionName, p: Record<string, unknown>): { title: string; preview: string } {
  const s = (k: string): string => (typeof p[k] === "string" ? (p[k] as string) : "");
  switch (action) {
    case "createProject":
      return {
        title: `Create Vercel project "${s("name") || "(unnamed)"}"`,
        preview:
          `Create a new Vercel project named "${s("name")}"` +
          (s("framework") ? ` (${s("framework")})` : "") +
          (s("gitRepo") ? `, linked to GitHub repo ${s("gitRepo")}` : "") +
          ` on your Vercel account.`,
      };
    case "setEnvVar":
      return {
        title: `Set env var "${s("key") || "(key)"}" on Vercel`,
        preview:
          `Set the ${p.encrypted === false ? "plain" : "encrypted"} environment variable ` +
          `"${s("key")}" on Vercel project ${s("projectId")}. The value is not shown here.`,
      };
    case "triggerDeploy":
      return {
        title: `Deploy Vercel project ${s("projectId") || "(project)"}`,
        preview:
          `Trigger a ${p.production === false ? "preview" : "production"} deployment of ` +
          `project ${s("projectId")}${s("ref") ? ` from ref ${s("ref")}` : " from main"}.`,
      };
    case "attachDomain":
      return {
        title: `Attach domain "${s("domain") || "(domain)"}" — single approval`,
        preview:
          `Attach the custom domain "${s("domain")}" to Vercel project ${s("projectId")}. ` +
          `This points live DNS traffic — it is approved one action at a time, every time.`,
      };
    case "getDeploymentStatus":
      // Read-only — never staged; included for exhaustiveness.
      return { title: "Check Vercel deployment status", preview: "" };
    default: {
      const _never: never = action;
      return { title: String(_never), preview: "" };
    }
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const { action } = parsed.data;
  const payload = parsed.data.payload as Record<string, unknown>;
  if (!isVercelAction(action)) {
    return NextResponse.json({ error: `Unknown Vercel action: ${action}` }, { status: 400 });
  }

  // ── Read-only: run inline, no approval ───────────────────────────────────────────────
  if (isVercelReadOnly(action)) {
    const exec = await executeVercelConnectorAction({ userId: user.id, action, payload });
    if (!exec.ok) return NextResponse.json({ error: exec.error }, { status: exec.status });
    return NextResponse.json({ executed: true, summary: exec.summary, data: exec.data });
  }

  // ── Gated: stage a build_action_approval card ────────────────────────────────────────
  const { title, preview } = describe(action, payload);
  let staged;
  try {
    staged = await stageConnectorAction({
      userId: user.id,
      subAgentRunId: null,
      connector: "vercel",
      action,
      payload,
      declaredScopes: ["vercel"],
      title,
      preview,
      kind: "build_action_approval",
    });
  } catch (e) {
    if (e instanceof ConnectorScopeError) {
      return NextResponse.json({ error: e.userMessage }, { status: 403 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't stage the action." },
      { status: 500 },
    );
  }

  // Auto-approve unlocked + enabled (never for attach_domain — Infinity window): fire now, same
  // execute path the Inbox approval uses, and resolve the staged card so it doesn't linger pending.
  if (staged.autoApproved) {
    const exec = await executeVercelConnectorAction({ userId: user.id, action, payload });
    if (!exec.ok) {
      // Leave the card pending so the owner can retry / reconnect — nothing fired.
      return NextResponse.json({ error: exec.error, inboxItemId: staged.inboxItemId }, { status: exec.status });
    }
    await resolveInboxItem(staged.inboxItemId, "approved", user.id);
    await recordAutoApproveSuccess(user.id, "vercel", action);
    return NextResponse.json({ executed: true, autoApproved: true, summary: exec.summary, data: exec.data });
  }

  return NextResponse.json({ staged: true, inboxItemId: staged.inboxItemId, title });
}
