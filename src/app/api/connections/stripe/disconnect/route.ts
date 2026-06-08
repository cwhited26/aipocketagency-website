import { createClient } from "@/lib/supabase/server";
import { stripeConnectConfig, deauthorizeAccount } from "@/lib/connectors/stripe/oauth";
import {
  fetchStripeConnectionFull,
  revokeStripeConnection,
} from "@/lib/pa-stripe-connections";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Best-effort deauthorize at Stripe (revokes the platform's access to the connected account)
  // before wiping the local row. A failure here is non-fatal — the row is soft-deleted regardless.
  const found = await fetchStripeConnectionFull(user.id);
  const config = stripeConnectConfig();
  if (found.ok && found.data?.stripeAccountId && config) {
    await deauthorizeAccount(found.data.stripeAccountId, config);
  }

  const result = await revokeStripeConnection(user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
