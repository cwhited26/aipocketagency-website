import { NextResponse } from "next/server";
import { z } from "zod";
import { insertEnterpriseApplication } from "@/lib/enterprise/db";
import { scoreApplication, routeForScore } from "@/lib/enterprise/scoring";
import type { EnterpriseApplicationInput } from "@/lib/enterprise/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Boundary validation for the public Enterprise application (Part 8E). Required fields mirror the
// form's required marks: email, company, role, what-you-sell, what's-not-working, biggest-bottleneck.
// Everything else is optional; strings default to "" and multi-selects to [] so scoring + insert
// always see a complete shape.
const str = z.string().trim().default("");
const strArr = z.array(z.string().trim().min(1)).max(40).default([]);

const BodySchema = z.object({
  firstName: str,
  lastName: str,
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.string().email(),
  ),
  phone: str,
  company: z.string().trim().min(1, "Company name is required").max(200),
  website: str,
  role: z.string().trim().min(1, "Role is required").max(120),
  businessType: str,
  whatYouSell: z.string().trim().min(1, "Tell us what you sell").max(4000),
  whoYouSellTo: str,
  monthlyRevenueRange: str,
  teamSize: str,
  currentAiTools: strArr,
  currentAiPain: z.string().trim().min(1, "Tell us what's not working").max(4000),
  contextLocations: strArr,
  desiredWorkflows: strArr,
  biggestBottleneck: z.string().trim().min(1, "Tell us your biggest bottleneck").max(4000),
  successOutcome: str.pipe(z.string().max(4000)),
  interestedApps: strArr,
  highVolumeUsage: str,
  needsPermissions: str,
  needsByoLlm: str,
  needsIntegrations: str,
  integrationSystems: str.pipe(z.string().max(4000)),
  timeline: str,
  implementationOwner: str,
  willingToGatherContext: str,
  usedPocketAgentBefore: str,
  budgetRange: str,
  dwyInterest: str,
  additionalNotes: str.pipe(z.string().max(4000)),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Please check the required fields." },
      { status: 400 },
    );
  }

  const app: EnterpriseApplicationInput = parsed.data;
  const score = scoreApplication(app);
  const route = routeForScore(score);

  const result = await insertEnterpriseApplication(app, score, route);
  if (!result.ok) {
    console.error("[enterprise/apply] failed to persist application", {
      status: result.status,
      error: result.error,
    });
    return NextResponse.json(
      { error: "We couldn't submit your application. Try again in a minute." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, route: `/enterprise/thanks?route=${route}` });
}
