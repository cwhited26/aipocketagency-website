import { NextResponse } from "next/server";
import { insertApaLead } from "@/lib/wc-admin-supabase";
import { isKitSlug } from "@/lib/kit-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SOURCE = "dispatch-playbook";

type LeadBody = {
  lead_id?: unknown;
  id?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  source?: unknown;
};

function pickTrimmed(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === "string") {
      const trimmed = c.trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Lead capture step 1 of the APA funnel.
 *
 * Inserts the lead row immediately (so wc-admin attribution still tracks
 * abandoners) and returns the URL of the next funnel page — the order-bump
 * interstitial at /[kit-slug]/upgrade-pair/<lead_id>. Stripe is NOT opened
 * here; the buyer makes the pair and bundle decisions first, then the
 * /api/apa/funnel/checkout endpoint mints the Stripe Checkout Session with
 * the right line items.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: LeadBody;
  try {
    body = (await req.json()) as LeadBody;
  } catch {
    return badRequest("Invalid JSON");
  }

  const leadId = pickTrimmed(body.lead_id, body.id);
  const name = pickTrimmed(body.name);
  const email = pickTrimmed(body.email);
  const phoneRaw = pickTrimmed(body.phone);
  const source = pickTrimmed(body.source) || DEFAULT_SOURCE;

  if (!UUID_V4_RE.test(leadId)) {
    const preview = leadId ? `${leadId.slice(0, 8)}...` : "(empty)";
    return badRequest(
      `Invalid lead id: expected RFC-4122 UUID v4, got: ${preview}`,
    );
  }
  if (!name) return badRequest("Name is required");
  if (!EMAIL_RE.test(email)) return badRequest("Invalid email");
  if (!isKitSlug(source)) return badRequest(`Unknown kit source: ${source}`);

  const phone = phoneRaw || null;

  const leadResult = await insertApaLead({
    id: leadId,
    name,
    email,
    phone,
    source,
    status: "new",
  });

  if (!leadResult.ok) {
    console.error("[apa/leads] Supabase insert failed", {
      status: leadResult.status,
      error: leadResult.error,
      lead_id: leadId,
    });
  }

  return NextResponse.json({
    lead_id: leadId,
    next_url: `/${source}/upgrade-pair/${encodeURIComponent(leadId)}`,
  });
}
