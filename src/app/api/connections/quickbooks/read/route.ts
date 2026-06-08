// POST /api/connections/quickbooks/read  { action, payload? }
// Read-only surface for the QuickBooks connector's read actions (list_customers, list_invoices,
// run_pl_report). Read actions bypass the approval Inbox (task item 5), so this executes
// immediately against the connected company. Writes are REFUSED here — they must go through the
// approval middleware + the standard approvals route.

import { createClient } from "@/lib/supabase/server";
import {
  isQuickBooksAction,
  isQuickBooksReadOnly,
  runQuickBooksAction,
} from "@/lib/connectors/quickbooks";
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

  if (!isQuickBooksAction(body.action)) {
    return NextResponse.json({ error: `Unknown QuickBooks action: ${body.action}` }, { status: 400 });
  }
  // Fail closed: only the read actions are allowed on this surface.
  if (!isQuickBooksReadOnly(body.action)) {
    return NextResponse.json(
      { error: `${body.action} is a write — it must be staged for approval, not run here.` },
      { status: 403 },
    );
  }

  const result = await runQuickBooksAction({
    userId: user.id,
    action: body.action,
    payload: body.payload ?? {},
    requestId: body.action, // unused for reads (only writes seed the QBO Request-Id)
    ownerEmail: user.email ?? null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, reauth: result.reauth }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
