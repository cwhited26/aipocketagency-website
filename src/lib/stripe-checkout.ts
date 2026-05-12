type LeadContext = {
  leadId: string;
  email: string;
  name: string;
  phone: string;
  source: string;
};

type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

type KitConfig = {
  priceId: string;
  successPath: string;
  cancelPath: string;
};

const KIT_CATALOG: Record<string, KitConfig> = {
  "dispatch-playbook": {
    priceId: "price_1TVyNTJ6S5nx9HK5MCGQTOoh",
    successPath: "/dispatch-playbook/success",
    cancelPath: "/dispatch-playbook/checkout?cancelled=1",
  },
  "dev-team-document-set": {
    priceId: "price_1TWGeWJ6S5nx9HK5mP8yAymx",
    successPath: "/dev-team-document-set/success",
    cancelPath: "/dev-team-document-set/checkout?cancelled=1",
  },
  "claude-md-template-library": {
    priceId: "price_1TWGeWJ6S5nx9HK5IKoOy5S1",
    successPath: "/claude-md-template-library/success",
    cancelPath: "/claude-md-template-library/checkout?cancelled=1",
  },
  "discovery-to-mvp-prompt-pack": {
    priceId: "price_1TWGeXJ6S5nx9HK55PFqTnlU",
    successPath: "/discovery-to-mvp-prompt-pack/success",
    cancelPath: "/discovery-to-mvp-prompt-pack/checkout?cancelled=1",
  },
  "wire-brain-to-stack-guide": {
    priceId: "price_1TWGeYJ6S5nx9HK5XDbZDGdD",
    successPath: "/wire-brain-to-stack-guide/success",
    cancelPath: "/wire-brain-to-stack-guide/checkout?cancelled=1",
  },
};

export function getKitConfig(source: string): KitConfig | null {
  return KIT_CATALOG[source] ?? null;
}

export async function createKitCheckout(
  ctx: LeadContext,
  origin: string,
): Promise<CheckoutResult> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { ok: false, status: 500, error: "STRIPE_SECRET_KEY not set" };
  }

  const kit = getKitConfig(ctx.source);
  if (!kit) {
    return {
      ok: false,
      status: 400,
      error: `Unknown kit source: ${ctx.source}`,
    };
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("customer_email", ctx.email);
  params.set("client_reference_id", ctx.leadId);
  params.set(
    "success_url",
    `${origin}${kit.successPath}?session_id={CHECKOUT_SESSION_ID}`,
  );
  params.set("cancel_url", `${origin}${kit.cancelPath}`);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price]", kit.priceId);
  params.set("metadata[lead_id]", ctx.leadId);
  params.set("metadata[name]", ctx.name);
  params.set("metadata[phone]", ctx.phone);
  params.set("metadata[source]", ctx.source);
  params.set("payment_intent_data[metadata][lead_id]", ctx.leadId);
  params.set("payment_intent_data[metadata][source]", ctx.source);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    return { ok: false, status: 500, error: "Stripe response missing url" };
  }
  return { ok: true, url: data.url };
}

export const createDispatchPlaybookCheckout = createKitCheckout;
