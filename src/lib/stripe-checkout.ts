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

const DISPATCH_PLAYBOOK_PRICE_ID = "price_1TVyNTJ6S5nx9HK5MCGQTOoh";

export async function createDispatchPlaybookCheckout(
  ctx: LeadContext,
  origin: string,
): Promise<CheckoutResult> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { ok: false, status: 500, error: "STRIPE_SECRET_KEY not set" };
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("customer_email", ctx.email);
  params.set("client_reference_id", ctx.leadId);
  params.set(
    "success_url",
    `${origin}/dispatch-playbook/success?session_id={CHECKOUT_SESSION_ID}`,
  );
  params.set("cancel_url", `${origin}/dispatch-playbook/checkout?cancelled=1`);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price]", DISPATCH_PLAYBOOK_PRICE_ID);
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
