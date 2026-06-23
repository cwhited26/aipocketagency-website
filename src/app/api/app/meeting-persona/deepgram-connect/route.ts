// POST /api/app/meeting-persona/deepgram-connect   { api_key }  → validate + encrypt + upsert
// DELETE /api/app/meeting-persona/deepgram-connect              → remove the connection
//
// The owner pastes their Deepgram API key (from console.deepgram.com). We validate it against the
// Deepgram REST API before persisting, then store it AES-256-GCM-encrypted (deepgram/key.ts). Same
// Studio+ tier gate as Recall (Meeting Persona is one App), enforced server-side.

import { createClient } from "@/lib/supabase/server";
import { verifyApiKey } from "@/lib/connectors/deepgram/client";
import { encryptDeepgramKey, isDeepgramKeyConfigured } from "@/lib/connectors/deepgram/key";
import {
  deleteDeepgramConnection,
  upsertDeepgramConnection,
} from "@/lib/connectors/deepgram/db";
import { getCurrentTier, tierAllowsMeetingPersona } from "@/lib/personas/tier-caps";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  api_key: z.string().min(20, "That doesn't look like a Deepgram API key.").max(400),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsMeetingPersona(tier)) {
    return NextResponse.json(
      { error: "Meeting Persona is a Studio plan feature. Upgrade to connect Deepgram." },
      { status: 403 },
    );
  }

  if (!isDeepgramKeyConfigured()) {
    return NextResponse.json(
      { error: "Deepgram connections aren't enabled on this workspace yet. Contact support." },
      { status: 503 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }
  const apiKey = parsed.data.api_key.trim();

  const valid = await verifyApiKey({ apiKey });
  if (!valid.ok) {
    const message = valid.authError
      ? "That API key was rejected by Deepgram. Generate a new one at console.deepgram.com and paste it again."
      : `Couldn't verify the key with Deepgram (${valid.status}). Try again.`;
    return NextResponse.json({ error: message }, { status: valid.authError ? 401 : 502 });
  }

  const saved = await upsertDeepgramConnection({
    ownerId: user.id,
    apiKeyEncrypted: encryptDeepgramKey(apiKey),
  });
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: saved.status });
  }

  return NextResponse.json({ connected: true, verified_at: saved.data.verifiedAt });
}

export async function DELETE(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const removed = await deleteDeepgramConnection(user.id);
  if (!removed.ok) {
    return NextResponse.json({ error: removed.error }, { status: removed.status });
  }
  return NextResponse.json({ connected: false });
}
