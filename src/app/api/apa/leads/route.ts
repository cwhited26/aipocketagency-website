import { NextResponse } from "next/server";
import { insertApaLead } from "@/lib/wc-admin-supabase";
import { createDispatchPlaybookCheckout } from "@/lib/stripe-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LeadBody = {
  id?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  source?: unknown;
};

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

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  const source = typeof body.source === "string" ? body.source.trim() : "";

  if (!UUID_V4_RE.test(id)) return badRequest("Invalid lead id");
  if (!name) return badRequest("Name is required");
  if (!EMAIL_RE.test(email)) return badRequest("Invalid email");
  if (!source) return badRequest("Source is required");

  const phone = phoneRaw || null;

  const leadResult = await insertApaLead({
    id,
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
      lead_id: id,
    });
  }

  const origin = new URL(req.url).origin;
  const checkout = await createDispatchPlaybookCheckout(
    {
      leadId: id,
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
      lead_id: id,
    });
    return NextResponse.json(
      { error: "Unable to start checkout. Please try again in a moment." },
      { status: 502 },
    );
  }

  return NextResponse.json({ checkout_url: checkout.url });
}
