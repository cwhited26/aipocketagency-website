// GET  /api/orchestrator/auto-approve            → list per-action trust state + toggles
// POST /api/orchestrator/auto-approve { connector, action, enabled }
//
// The trust ladder (PA-ORCH-4): a per-(connector, action) auto-approve toggle. Turning a
// toggle ON is gated on the action type having cleared the trust window (N successful manual
// Approves, tracked atomically by the approve route). Turning OFF is always allowed — "show me
// first" is the safe default the owner can return to any time.

import { createClient } from "@/lib/supabase/server";
import {
  OrchestratorDbError,
  fetchAutoApproveSetting,
  listAutoApproveSettings,
  setAutoApproveEnabled,
} from "@/lib/orchestrator/db";
import { AUTO_APPROVE_TRUST_WINDOW, autoApproveUnlocked } from "@/lib/orchestrator/tier-caps";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await listAutoApproveSettings(user.id);
    const settings = rows.map((r) => ({
      connector: r.connector,
      action: r.action,
      enabled: r.enabled,
      successCount: r.success_count,
      unlocked: autoApproveUnlocked(r.success_count),
      lastToggledAt: r.last_toggled_at,
    }));
    return NextResponse.json({ settings, trustWindow: AUTO_APPROVE_TRUST_WINDOW });
  } catch (e) {
    // Wave B ships dark behind PA_ORCHESTRATOR_ENABLED; until migration 021 is applied the
    // trust-ladder table doesn't exist. Render the page's "nothing staged yet" empty state
    // instead of a 500 — but only for that specific not-provisioned case. Any other DB
    // failure still surfaces as an error the owner can see.
    if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) {
      return NextResponse.json({ settings: [], trustWindow: AUTO_APPROVE_TRUST_WINDOW });
    }
    const status = e instanceof OrchestratorDbError ? e.status : 500;
    return NextResponse.json({ error: "Failed to load auto-approve settings" }, { status });
  }
}

const ToggleSchema = z.object({
  connector: z.string().min(1).max(120),
  action: z.string().min(1).max(120),
  enabled: z.boolean(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof ToggleSchema>;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    input = ToggleSchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Enabling requires the trust window to be cleared; disabling is always allowed.
  if (input.enabled) {
    const current = await fetchAutoApproveSetting(user.id, input.connector, input.action);
    const count = current?.success_count ?? 0;
    if (!autoApproveUnlocked(count)) {
      return NextResponse.json(
        {
          error:
            `Auto-approve for ${input.connector} · ${input.action} unlocks after ` +
            `${AUTO_APPROVE_TRUST_WINDOW} approvals (you're at ${count}).`,
          successCount: count,
          trustWindow: AUTO_APPROVE_TRUST_WINDOW,
        },
        { status: 403 },
      );
    }
  }

  const row = await setAutoApproveEnabled({
    userId: user.id,
    connector: input.connector,
    action: input.action,
    enabled: input.enabled,
  });
  return NextResponse.json({
    connector: row.connector,
    action: row.action,
    enabled: row.enabled,
    successCount: row.success_count,
    unlocked: autoApproveUnlocked(row.success_count),
  });
}
