// POST /api/app/browser/tools/<tool>  { ...toolInput }
// The invocation entrypoint for a single browser_* tool (the dispatcher / agent calls this, and it's
// the surface the settings "test" affordance hits). Resolves the owner + tier, then runs the full
// gate pipeline (refuse list → tier cap → per-domain Trust Ladder) via stageBrowserToolCall. Returns
// the outcome: refused / blocked / executed-inline / staged-for-approval.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { stageBrowserToolCall } from "@/lib/browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Browser launches can take real time; give the function room under the 60s pool budget.
export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: { tool: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: Record<string, unknown>;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tier = await getCurrentTier(user.id);
  const result = await stageBrowserToolCall({
    userId: user.id,
    tier,
    tool: params.tool,
    input,
  });

  switch (result.kind) {
    case "invalid":
      return NextResponse.json({ status: "invalid", error: result.error }, { status: 422 });
    case "refused":
      return NextResponse.json(
        { status: "refused", reason: result.reason, actionId: result.actionId },
        { status: 403 },
      );
    case "blocked":
      return NextResponse.json(
        { status: "blocked", reason: result.reason, actionId: result.actionId },
        { status: 429 },
      );
    case "executed":
      return result.result.ok
        ? NextResponse.json({
            status: "executed",
            actionId: result.actionId,
            summary: result.result.summary,
            data: result.result.data,
          })
        : NextResponse.json(
            { status: "failed", actionId: result.actionId, error: result.result.error },
            { status: 502 },
          );
    case "staged":
      return NextResponse.json({
        status: "staged",
        actionId: result.actionId,
        inboxItemId: result.inboxItemId,
        message: "Staged a browser_action_approval card in Mission Control — approve it to run.",
      });
  }
}
