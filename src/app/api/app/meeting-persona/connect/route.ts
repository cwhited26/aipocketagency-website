// POST /api/app/meeting-persona/connect   { api_key }  → validate + encrypt + upsert
// DELETE /api/app/meeting-persona/connect              → remove the connection
//
// The owner pastes their Recall.ai API key (generated in the Recall dashboard). We validate it
// against the Recall API before persisting anything, then store it AES-256-GCM-encrypted
// (lib/crypto/recall-key.ts) — never plaintext. Meeting Persona is a Studio+ App (MP-1), so the
// route also enforces the tier gate server-side, not just in the UI.

import { createClient } from "@/lib/supabase/server";
import { validateApiKey } from "@/lib/connectors/recall-ai/client";
import { encryptRecallKey, isRecallKeyConfigured } from "@/lib/crypto/recall-key";
import {
  deleteRecallConnection,
  upsertRecallConnection,
} from "@/lib/connectors/recall-ai/db";
import { getCurrentTier, tierAllowsMeetingPersona } from "@/lib/personas/tier-caps";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  api_key: z.string().min(20, "That doesn't look like a Recall.ai API key.").max(400),
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
      { error: "Meeting Persona is a Studio plan feature. Upgrade to connect Recall.ai." },
      { status: 403 },
    );
  }

  if (!isRecallKeyConfigured()) {
    return NextResponse.json(
      { error: "Recall.ai connections aren't enabled on this workspace yet. Contact support." },
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

  // Validate against the Recall API before persisting anything.
  const valid = await validateApiKey(apiKey);
  if (!valid.ok) {
    const message = valid.authError
      ? "That API key was rejected by Recall.ai. Generate a new one in the Recall dashboard and paste it again."
      : `Couldn't verify the key with Recall.ai (${valid.status}). Try again.`;
    return NextResponse.json({ error: message }, { status: valid.authError ? 401 : 502 });
  }

  const saved = await upsertRecallConnection({
    ownerId: user.id,
    apiKeyEncrypted: encryptRecallKey(apiKey),
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

  const removed = await deleteRecallConnection(user.id);
  if (!removed.ok) {
    return NextResponse.json({ error: removed.error }, { status: removed.status });
  }
  return NextResponse.json({ connected: false });
}
