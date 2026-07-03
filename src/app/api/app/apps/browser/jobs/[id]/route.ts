// GET /api/app/apps/browser/jobs/<id> — one job + its step timeline, screenshots signed fresh
// per request (the stored paths never carry credentials). The detail page polls this every 3s
// while the job is live.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchBrowserJob, listBrowserSteps } from "@/lib/browser-agent/db";
import { signJobScreenshotUrl } from "@/lib/browser-agent/screenshots";
import { toJobDetailView, toStepView } from "@/lib/browser-agent/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
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
  if (!jobRes.data) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const stepsRes = await listBrowserSteps({ jobId: params.id, ownerId: user.id });
  const stepRows = stepsRes.ok ? stepsRes.data : [];

  const steps = await Promise.all(
    stepRows.map(async (row) =>
      toStepView(row, row.screenshot_path ? await signJobScreenshotUrl(row.screenshot_path) : null),
    ),
  );

  return NextResponse.json({ job: toJobDetailView(jobRes.data, steps) });
}
