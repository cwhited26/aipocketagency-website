import { createClient } from "@/lib/supabase/server";
import { toggleRoutine, ROUTINE_KINDS } from "@/lib/pa-routines";
import { z } from "zod";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ enabled: z.boolean() });

export async function POST(
  req: Request,
  { params }: { params: { kind: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(ROUTINE_KINDS as readonly string[]).includes(params.kind)) {
    return NextResponse.json({ error: "Invalid routine kind" }, { status: 400 });
  }
  const kind = params.kind as (typeof ROUTINE_KINDS)[number];

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body: expected { enabled: boolean }" }, { status: 400 });
  }

  const result = await toggleRoutine(user.id, kind, parsed.data.enabled);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
