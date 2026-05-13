import { NextResponse } from "next/server";
import { insertApaLead } from "@/lib/wc-admin-supabase";
import { isKitSlug } from "@/lib/kit-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SOURCE = "dispatch-playbook";

/**
 * Valid waitlist bundle slugs (underscore form, matches the
 * `apa_leads.waitlist_for` column values). These are NOT $15 kit
 * slugs — they're the "Coming Soon" bundle landing pages at
 * /capture-pack and /output-pack (URL paths are hyphenated for SEO; the
 * data values posted are underscored to read clean as a DB column).
 * Each module flips to LIVE as it ships; the bundle waitlist remains
 * the catalog entry point.
 */
const WAITLIST_SLUGS = ["capture_pack", "output_pack"] as const;
type WaitlistSlug = (typeof WAITLIST_SLUGS)[number];

function isWaitlistSlug(value: string): value is WaitlistSlug {
  return (WAITLIST_SLUGS as readonly string[]).includes(value);
}

type LeadBody = {
  lead_id?: unknown;
  id?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  source?: unknown;
  waitlist_for?: unknown;
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
 * Two modes:
 *
 *   1. **Kit-funnel mode** (default): caller posts a $15 kit slug as
 *      `source`. Insert the lead, return `next_url` pointing at the
 *      order-bump interstitial (`/[kit-slug]/upgrade-pair/<lead_id>`).
 *      Stripe is opened later, after the buyer makes the pair + bundle
 *      decisions.
 *
 *   2. **Waitlist mode**: caller posts `waitlist_for` =
 *      `'capture_pack' | 'output_pack'`. The Capture Pack and Output
 *      Pack catalogs are publicly visible while individual modules
 *      ship; the waitlist collects names for "notify me on launch"
 *      drips. No Stripe Checkout Session, no order-bump page — just a
 *      lead row with `waitlist_for` populated, source mirrored to the
 *      bundle slug. Drip integration is queued separately; for now we
 *      only store the lead.
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
  const sourceRaw = pickTrimmed(body.source);
  const waitlistForRaw = pickTrimmed(body.waitlist_for);

  if (!UUID_V4_RE.test(leadId)) {
    const preview = leadId ? `${leadId.slice(0, 8)}...` : "(empty)";
    return badRequest(
      `Invalid lead id: expected RFC-4122 UUID v4, got: ${preview}`,
    );
  }
  if (!name) return badRequest("Name is required");
  if (!EMAIL_RE.test(email)) return badRequest("Invalid email");

  const waitlistFor = waitlistForRaw || null;
  if (waitlistFor && !isWaitlistSlug(waitlistFor)) {
    return badRequest(`Unknown waitlist bundle: ${waitlistFor}`);
  }

  let source: string;
  if (waitlistFor) {
    source = sourceRaw || waitlistFor;
    if (!isWaitlistSlug(source) && !isKitSlug(source)) {
      return badRequest(`Unknown lead source: ${source}`);
    }
  } else {
    source = sourceRaw || DEFAULT_SOURCE;
    if (!isKitSlug(source)) return badRequest(`Unknown kit source: ${source}`);
  }

  const phone = phoneRaw || null;

  const leadResult = await insertApaLead({
    id: leadId,
    name,
    email,
    phone,
    source,
    status: "new",
    waitlist_for: waitlistFor,
  });

  if (!leadResult.ok) {
    console.error("[apa/leads] Supabase insert failed", {
      status: leadResult.status,
      error: leadResult.error,
      lead_id: leadId,
      waitlist_for: waitlistFor,
    });
  }

  if (waitlistFor) {
    return NextResponse.json({
      lead_id: leadId,
      waitlist_for: waitlistFor,
      status: "waitlisted",
    });
  }

  return NextResponse.json({
    lead_id: leadId,
    next_url: `/${source}/upgrade-pair/${encodeURIComponent(leadId)}`,
  });
}
