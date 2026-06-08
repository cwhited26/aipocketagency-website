// POST /api/connections/calendly/read  { action, payload? }
// Read-only surface for the Calendly connector's read actions (list_event_types,
// list_scheduled_events, list_invitees). Read actions bypass the approval Inbox (task item 8), so
// this executes immediately against the connected account. Writes are REFUSED here — they must go
// through the approval middleware + the dedicated approve route.

import { createClient } from "@/lib/supabase/server";
import {
  isCalendlyAction,
  isCalendlyReadOnly,
  runCalendlyAction,
} from "@/lib/connectors/calendly";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  action: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
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

  if (!isCalendlyAction(body.action)) {
    return NextResponse.json({ error: `Unknown Calendly action: ${body.action}` }, { status: 400 });
  }
  // Fail closed: only the read actions are allowed on this surface.
  if (!isCalendlyReadOnly(body.action)) {
    return NextResponse.json(
      { error: `${body.action} is a write — it must be staged for approval, not run here.` },
      { status: 403 },
    );
  }

  const result = await runCalendlyAction({
    userId: user.id,
    action: body.action,
    payload: body.payload ?? {},
    ownerEmail: user.email ?? null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, reauth: result.reauth }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
