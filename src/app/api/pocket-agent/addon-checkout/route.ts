import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getAddonMeta,
  isAddonCheckoutKind,
  type AddonCheckoutKind,
} from "@/lib/pocket-agent-addons";
import { buildAddonCheckoutParams } from "@/lib/pocket-agent-addon-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Boundary validation. `kind` is the one-time product; `session_id` is the prior subscription
// Checkout Session (present for the /upsell setup charges, so we can tie the charge to the same
// customer); `email` is collected on /downsell where there is no prior session.
const BodySchema = z.object({
  kind: z.string(),
  session_id: z.string().optional(),
  email: z
    .preprocess(
      (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
      z.string().email(),
    )
    .optional(),
});

const STRIPE_VERSION = "2024-09-30.acacia";

type PriorSession = { customerId: string | null; email: string | null };

/** Retrieve a prior Checkout Session to recover its customer + email for the upsell charge. */
async function retrievePriorSession(
  secret: string,
  sessionId: string,
): Promise<PriorSession | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: {
        Authorization: `Bearer ${secret}`,
        "Stripe-Version": STRIPE_VERSION,
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const error = await res.text();
    console.error("[pocket-agent/addon-checkout] failed to retrieve prior session", {
      session_id: sessionId,
      status: res.status,
      error,
    });
    return null;
  }
  const data = (await res.json()) as {
    customer?: string | null;
    customer_email?: string | null;
    customer_details?: { email?: string | null } | null;
  };
  return {
    customerId: data.customer ?? null,
    email: data.customer_email ?? data.customer_details?.email ?? null,
  };
}

function thanksPath(kind: AddonCheckoutKind): string {
  switch (kind) {
    case "pilot":
      return "/thanks?bought=pilot";
    case "workflow_vault":
      return "/thanks?bought=workflow_vault";
    case "diy_setup_kit":
      return "/thanks?bought=diy_setup_kit";
    default:
      return "/thanks?bought=subscription_plus_setup";
  }
}

function cancelPath(kind: AddonCheckoutKind, sessionId: string | null): string {
  switch (kind) {
    case "pilot":
      return "/downsell";
    case "diy_setup_kit":
      return "/downsell-kit";
    case "workflow_vault":
      return "/app/apps/workflow-vault";
    default:
      return sessionId ? `/upsell?session_id=${encodeURIComponent(sessionId)}` : "/upsell";
  }
}

/** Kinds bought by a fresh visitor (not necessarily signed in) — they need an email for the receipt. */
function requiresEmail(kind: AddonCheckoutKind): boolean {
  return kind === "pilot" || kind === "diy_setup_kit";
}

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    console.error("[pocket-agent/addon-checkout] STRIPE_SECRET_KEY not set");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success || !isAddonCheckoutKind(parsed.data.kind)) {
    return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  }
  const kind = parsed.data.kind;
  const sessionId = parsed.data.session_id ?? null;

  // Recover the customer for the setup upsell from the prior subscription session.
  let customerId: string | null = null;
  let email: string | null = parsed.data.email ?? null;
  if (kind !== "pilot" && sessionId) {
    const prior = await retrievePriorSession(secret, sessionId);
    if (prior) {
      customerId = prior.customerId;
      email = email ?? prior.email;
    }
  }

  // Fresh-visitor products (pilot, DIY kit) need an email to attach a customer + send the receipt/link.
  if (requiresEmail(kind) && !email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  // Thread the signed-in user id when present so the webhook can link the ledger row to the account.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const origin = new URL(req.url).origin;
  const params = buildAddonCheckoutParams({
    kind,
    origin,
    successPath: thanksPath(kind),
    cancelPath: cancelPath(kind, sessionId),
    email,
    customerId,
    userId: user?.id ?? null,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_VERSION,
    },
    body: params.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("[pocket-agent/addon-checkout] Stripe session creation failed", {
      kind,
      amount_cents: getAddonMeta(kind).amountCents,
      status: res.status,
      error,
    });
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 },
    );
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    console.error("[pocket-agent/addon-checkout] Stripe response missing url", { kind });
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
  return NextResponse.json({ checkout_url: data.url });
}
