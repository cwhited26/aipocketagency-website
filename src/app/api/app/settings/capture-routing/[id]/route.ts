// /api/app/settings/capture-routing/[id] — update + delete one routing rule (PA-CAPTURE-1). Both
// scope the write to the owner (RLS is defense-in-depth; the data layer's owner_id filter is the real
// gate). PATCH accepts a partial of the same fields the create route validates.

import { createClient } from "@/lib/supabase/server";
import { deleteRoutingRule, updateRoutingRule } from "@/lib/capture-inbox/rules";
import { CAPTURE_CONTENT_TYPES, type CaptureMatchPattern } from "@/lib/capture-inbox/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const matchPatternSchema = z
  .object({
    keywords: z.array(z.string().min(1).max(120)).max(50).optional(),
    regex: z.string().max(500).optional(),
    sourceUrlContains: z.string().max(300).optional(),
    contentType: z.enum(CAPTURE_CONTENT_TYPES as unknown as [string, ...string[]]).optional(),
  })
  .superRefine((p, ctx) => {
    const hasCondition =
      (p.keywords && p.keywords.length > 0) ||
      (p.regex && p.regex.trim()) ||
      (p.sourceUrlContains && p.sourceUrlContains.trim()) ||
      Boolean(p.contentType);
    if (!hasCondition) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Add at least one match condition." });
    }
    if (p.regex && p.regex.trim()) {
      try {
        new RegExp(p.regex, "i");
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "That pattern isn't valid." });
      }
    }
  });

const patchSchema = z
  .object({
    matchPattern: matchPatternSchema.optional(),
    targetPath: z
      .string()
      .min(1)
      .max(300)
      .refine((p) => !p.includes(".."), "Target path can't contain '..'.")
      .refine((p) => !p.startsWith("/"), "Target path can't start with '/'.")
      .optional(),
    enabled: z.boolean().optional(),
    priority: z.number().int().min(-1000).max(1000).optional(),
  })
  .refine((p) => Object.keys(p).length > 0, "Nothing to update.");

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
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
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const result = await updateRoutingRule({
    id: params.id,
    ownerId: user.id,
    patch: {
      ...(parsed.data.matchPattern !== undefined
        ? { matchPattern: parsed.data.matchPattern as CaptureMatchPattern }
        : {}),
      ...(parsed.data.targetPath !== undefined ? { targetPath: parsed.data.targetPath.trim() } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
    },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ rule: result.data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await deleteRoutingRule(params.id, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
