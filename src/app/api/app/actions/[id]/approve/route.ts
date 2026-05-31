import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  fetchActionById,
  updateActionStatus,
  updateBrainMemoryPayloadSchema,
} from "@/lib/pa-actions";
import { commitMemoryFile } from "@/lib/pa-brain";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const actionResult = await fetchActionById(id);
  if (!actionResult.ok) {
    return NextResponse.json({ error: actionResult.error }, { status: actionResult.status });
  }
  const action = actionResult.data;
  if (!action) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership gate
  if (action.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotency — already past the gate, return as-is
  if (action.status === "executed" || action.status === "executing") {
    return NextResponse.json({ action });
  }

  if (action.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot approve action with status '${action.status}'` },
      { status: 409 },
    );
  }

  // Mark executing + record decided_at
  const now = new Date().toISOString();
  const execResult = await updateActionStatus(id, { status: "executing", decided_at: now });
  if (!execResult.ok) {
    return NextResponse.json({ error: execResult.error }, { status: execResult.status });
  }

  // Execute based on action_type
  if (action.action_type === "update_brain_memory") {
    const payloadResult = updateBrainMemoryPayloadSchema.safeParse(action.payload);
    if (!payloadResult.success) {
      await updateActionStatus(id, {
        status: "failed",
        error: `Invalid payload: ${payloadResult.error.message}`,
      });
      return NextResponse.json({ error: "Invalid action payload" }, { status: 422 });
    }

    const { repo, path, mode, content } = payloadResult.data;

    const paResult = await fetchPaUser(user.id);
    if (!paResult.ok || !paResult.data?.github_token) {
      const errMsg = "No GitHub token available to execute the action.";
      await updateActionStatus(id, { status: "failed", error: errMsg });
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    const commitResult = await commitMemoryFile({
      repo,
      token: paResult.data.github_token,
      path,
      mode,
      content,
      commitMessage: `Pocket Agent — ${mode === "append" ? "append to" : "update"} ${path}`,
    });

    if (!commitResult.ok) {
      await updateActionStatus(id, { status: "failed", error: commitResult.error });
      return NextResponse.json({ error: commitResult.error }, { status: 502 });
    }

    const finalResult = await updateActionStatus(id, {
      status: "executed",
      executed_at: new Date().toISOString(),
      result: { sha: commitResult.sha, repo, path },
    });

    return NextResponse.json({ action: finalResult.ok ? finalResult.data : execResult.data });
  }

  // routine_output — acknowledgement only, no GitHub write required.
  if (action.action_type === "routine_output") {
    const finalResult = await updateActionStatus(id, {
      status: "executed",
      executed_at: new Date().toISOString(),
      result: { acknowledged: true },
    });
    return NextResponse.json({ action: finalResult.ok ? finalResult.data : execResult.data });
  }

  const unknownErr = `Unknown action_type: ${action.action_type}`;
  await updateActionStatus(id, { status: "failed", error: unknownErr });
  return NextResponse.json({ error: "Unknown action type" }, { status: 422 });
}
