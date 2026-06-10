// /api/app/settings/capture-routing — list + create the owner's Capture Inbox routing rules
// (PA-CAPTURE-1). A rule files a matching shared item straight into a dedicated brain path instead of
// leaving it in memory/inbox.md. Owner-scoped via the session; all writes go through the service-role
// data layer in lib/capture-inbox/rules.ts.

import { createClient } from "@/lib/supabase/server";
import { createRoutingRule, listRoutingRules } from "@/lib/capture-inbox/rules";
import { CAPTURE_CONTENT_TYPES, type CaptureMatchPattern } from "@/lib/capture-inbox/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listRoutingRules(user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ rules: result.data });
}

const matchPatternSchema = z
  .object({
    keywords: z.array(z.string().min(1).max(120)).max(50).optional(),
    regex: z.string().max(500).optional(),
    sourceUrlContains: z.string().max(300).optional(),
    contentType: z.enum(CAPTURE_CONTENT_TYPES as unknown as [string, ...string[]]).optional(),
  })
  .superRefine((p, ctx) => {
    // A rule with no conditions would match nothing — reject it so the owner gets clear feedback.
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

// A brain path: no leading slash, no parent-directory traversal. Empty / traversal is rejected.
const targetPathSchema = z
  .string()
  .min(1)
  .max(300)
  .refine((p) => !p.includes(".."), "Target path can't contain '..'.")
  .refine((p) => !p.startsWith("/"), "Target path can't start with '/'.");

const createSchema = z.object({
  matchPattern: matchPatternSchema,
  targetPath: targetPathSchema,
  enabled: z.boolean().optional(),
  priority: z.number().int().min(-1000).max(1000).optional(),
});

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
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const result = await createRoutingRule({
    ownerId: user.id,
    matchPattern: parsed.data.matchPattern as CaptureMatchPattern,
    targetPath: parsed.data.targetPath.trim(),
    enabled: parsed.data.enabled ?? true,
    priority: parsed.data.priority ?? 0,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ rule: result.data }, { status: 201 });
}
