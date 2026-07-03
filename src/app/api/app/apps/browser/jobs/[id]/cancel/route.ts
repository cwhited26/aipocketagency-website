// POST /api/app/apps/browser/jobs/<id>/cancel — the owner's stop button. A live job goes to
// 'canceled', its Browserbase session is released, and any pending approval card resolves as
// rejected so Mission Control doesn't carry a card for a job that no longer runs.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchBrowserJob, updateBrowserJob } from "@/lib/browser-agent/db";
import { releaseBrowserbaseSession } from "@/modules/integrations/browserbase/adapter";
import { resolveInboxItem } from "@/lib/pa-inbox-items";
import { PendingStepSchema, isTerminalStatus, parseJobState } from "@/lib/browser-agent/types";

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

  const jobRes = await fetchBrowserJob({ jobId: params.id, ownerId: user.id });
  if (!jobRes.ok) return NextResponse.json({ error: "Could not load the job" }, { status: 500 });
  const job = jobRes.data;
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (isTerminalStatus(job.status)) {
    return NextResponse.json({ error: `Already ${job.status}` }, { status: 409 });
  }

  const updated = await updateBrowserJob(job.id, {
    status: "canceled",
    completed_at: new Date().toISOString(),
    lease_until: null,
  });
  if (!updated.ok) {
    return NextResponse.json({ error: "Could not cancel the job" }, { status: 500 });
  }

  // Best-effort cleanup — the job is already canceled either way.
  const state = parseJobState(job.state_json);
  const sessionId = job.browserbase_session_id ?? state.browserbase?.sessionId ?? null;
  if (sessionId) {
    const released = await releaseBrowserbaseSession(sessionId);
    if (!released.ok) {
      console.warn("[browser-agent/cancel] session release failed", {
        jobId: job.id,
        error: released.error,
      });
    }
  }
  const pending = PendingStepSchema.safeParse(job.pending_step);
  if (pending.success) {
    const resolved = await resolveInboxItem(pending.data.inboxItemId, "rejected", user.id);
    if (!resolved.ok) {
      console.warn("[browser-agent/cancel] pending card resolve failed", {
        jobId: job.id,
        error: resolved.error,
      });
    }
  }

  return NextResponse.json({ status: "canceled" });
}
