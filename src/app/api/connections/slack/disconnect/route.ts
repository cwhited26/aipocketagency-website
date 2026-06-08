import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto/encrypt";
import { revokeToken } from "@/lib/slack";
import { ensureFreshSlackToken } from "@/lib/connectors/slack/oauth";
import {
  fetchSlackConnectionFull,
  revokeSlackConnection,
} from "@/lib/pa-slack-connections";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Best-effort revoke at Slack before wiping the stored token. For a rotation install the
  // durable secret is a refresh token, so resolve the live bot token via ensureFreshSlackToken;
  // for a long-lived install the durable secret is the bot token itself.
  const found = await fetchSlackConnectionFull(user.id);
  if (found.ok && found.data?.refresh_token_encrypted) {
    const token = await ensureFreshSlackToken(found.data);
    if (token.ok) {
      await revokeToken(token.data);
    } else {
      try {
        await revokeToken(decrypt(found.data.refresh_token_encrypted));
      } catch {
        // Decrypt/revoke failure is non-fatal — we still soft-delete the row below.
      }
    }
  }

  const result = await revokeSlackConnection(user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
