import { NextResponse } from "next/server";
import { insertApaLead } from "@/lib/wc-admin-supabase";
import { createKitCheckout, getKitConfig } from "@/lib/stripe-checkout";

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
  if (!getKitConfig(source)) return badRequest(`Unknown kit source: ${source}`);

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

  const origin = new URL(req.url).origin;
  const checkout = await createKitCheckout(
    {
      leadId,
      email,
      name,
      phone: phone ?? "",
      source,
    },
    origin,
  );

  if (!checkout.ok) {
    console.error("[apa/leads] Stripe Checkout Session failed", {
      status: checkout.status,
      error: checkout.error,
      lead_id: leadId,
    });
    return NextResponse.json(
      { error: "Unable to start checkout. Please try again in a moment." },
      { status: 502 },
    );
  }

  return NextResponse.json({ checkout_url: checkout.url });
}
