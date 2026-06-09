// GET  /api/orchestrator/gates/settings → the owner's per-gate Trust Ladder state.
// POST /api/orchestrator/gates/settings  { gateName, enabled? , autoDismissEnabled? }
//
// The Trust Ladder (SPEC §9, PA-GATE-5). The owner can skip a gate (enabled) or turn on per-gate
// Approve-anyway (auto_dismiss). Enabling auto-dismiss is gated SERVER-SIDE on the gate having
// cleared its trust window (clean_pass_count >= threshold) — a day-1 owner cannot self-grant the
// override. Disabling is always allowed. Wholesale opt-out of the phase is NOT offered (PA-GATE-1).

import { createClient } from "@/lib/supabase/server";
import {
  fetchGateOverride,
  listGateOverrides,
  upsertGateOverride,
  type GateOverrideRow,
} from "@/lib/orchestrator/gates/db";
import { GATE_REGISTRY, ALL_GATES } from "@/lib/orchestrator/gates/registry";
import { gateTrustWindow, autoDismissUnlocked } from "@/lib/orchestrator/gates/trust";
import { GATE_NAMES, type GateName } from "@/lib/orchestrator/gates/schema";
import { OrchestratorDbError } from "@/lib/orchestrator/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type GateSettingView = {
  name: GateName;
  label: string;
  description: string;
  appliesTo: "always" | "code";
  enabled: boolean;
  autoDismissEnabled: boolean;
  cleanPassCount: number;
  trustWindow: number;
  autoDismissUnlocked: boolean;
};

function viewFor(name: GateName, row: GateOverrideRow | undefined): GateSettingView {
  const def = GATE_REGISTRY[name];
  const cleanPassCount = row?.clean_pass_count ?? 0;
  return {
    name,
    label: def.label,
    description: def.description,
    appliesTo: def.appliesTo,
    enabled: row?.enabled ?? def.enabledByDefault,
    autoDismissEnabled: row?.auto_dismiss_enabled ?? false,
    cleanPassCount,
    trustWindow: gateTrustWindow(name),
    autoDismissUnlocked: autoDismissUnlocked(name, cleanPassCount),
  };
}

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await listGateOverrides(user.id);
    const byName = new Map(rows.map((r) => [r.gate_name, r]));
    const gates = ALL_GATES.map((def) => viewFor(def.name, byName.get(def.name)));
    return NextResponse.json({ gates, provisioned: true });
  } catch (e) {
    // Schema not applied yet → return library defaults rather than a hard 500 (ships dark).
    if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) {
      const gates = ALL_GATES.map((def) => viewFor(def.name, undefined));
      return NextResponse.json({ gates, provisioned: false });
    }
    const message = e instanceof Error ? e.message : "Failed to load gate settings";
    const status = e instanceof OrchestratorDbError ? e.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

const BodySchema = z
  .object({
    gateName: z.enum(GATE_NAMES),
    enabled: z.boolean().optional(),
    autoDismissEnabled: z.boolean().optional(),
  })
  .refine((b) => b.enabled !== undefined || b.autoDismissEnabled !== undefined, {
    message: "nothing to change",
  });

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse((await req.json().catch(() => ({}))) as unknown);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const gateName = body.gateName as GateName;

  // Server-side gate: turning auto-dismiss ON requires the trust window to be cleared.
  if (body.autoDismissEnabled === true) {
    const row = await fetchGateOverride(user.id, gateName).catch(() => null);
    const count = row?.clean_pass_count ?? 0;
    if (!autoDismissUnlocked(gateName, count)) {
      return NextResponse.json(
        {
          error: `Approve-anyway for ${GATE_REGISTRY[gateName].label} unlocks after ${gateTrustWindow(gateName)} clean passes (${count} so far).`,
        },
        { status: 403 },
      );
    }
  }

  try {
    const updated = await upsertGateOverride({
      userId: user.id,
      gateName,
      enabled: body.enabled,
      autoDismissEnabled: body.autoDismissEnabled,
    });
    return NextResponse.json({ gate: viewFor(gateName, updated) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update gate setting";
    const status = e instanceof OrchestratorDbError ? e.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
