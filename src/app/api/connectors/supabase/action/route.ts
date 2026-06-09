// POST /api/connectors/supabase/action  { action, payload, subAgentRunId? }
//
// The internal entry point for a Supabase Build action.
//   • Read actions (run_sql_read_only, get_connection_string) execute INLINE and return their data.
//     run_sql_read_only's query is rejected at parse time by sql-guard before any call fires.
//   • Write actions (create_project, apply_migration, seed_data) STAGE a kind='build_action_approval'
//     card via the shared stageConnectorAction() — nothing fires until the owner approves it on the
//     Inbox (which calls /api/orchestrator/approvals/[id] → executeConnectorAction → this connector).
//     The approval card renders `preview` in full, so the COMPLETE migration / seed SQL is the
//     preview; the seed card prefixes a warning when the SQL also deletes/updates rows.
//
// The create_project db_pass is a secret, so it is AES-256-GCM-encrypted in the staged payload
// (db_pass_encrypted) and never written plaintext — the connector executor decrypts it at run time.

import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto/encrypt";
import {
  SUPABASE_CONNECTOR,
  isSupabaseAction,
  isSupabaseReadOnly,
  runSupabaseAction,
  type SupabaseExecuteResult,
} from "@/lib/connectors/supabase";
import type { SupabaseActionName } from "@/lib/connectors/supabase/types";
import { destructiveSqlWarnings } from "@/lib/connectors/supabase/sql-guard";
import { fetchSupabaseConnectionPublic } from "@/lib/pa-supabase-connections";
import { stageConnectorAction, ConnectorScopeError } from "@/lib/orchestrator/tool-use";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  action: z.string().min(1).max(60),
  payload: z.record(z.string(), z.unknown()).default({}),
  subAgentRunId: z.string().min(1).max(200).optional(),
});

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

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

  if (!isSupabaseAction(body.action)) {
    return NextResponse.json({ error: `Unknown Supabase action: ${body.action}` }, { status: 400 });
  }
  const action = body.action;

  // The connection must be live before reading or staging anything.
  const conn = await fetchSupabaseConnectionPublic(user.id);
  if (!conn.ok) return NextResponse.json({ error: conn.error }, { status: conn.status });
  if (!conn.data || conn.data.status === "revoked") {
    return NextResponse.json(
      { error: "Connect Supabase in Settings → Connections first." },
      { status: 409 },
    );
  }

  // ── Reads run inline ──────────────────────────────────────────────────────────────────────
  if (isSupabaseReadOnly(action)) {
    const result: SupabaseExecuteResult = await runSupabaseAction({
      userId: user.id,
      action,
      payload: body.payload,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ executed: true, summary: result.summary, data: result.data });
  }

  // ── Writes stage a build_action_approval card via the shared staging helper ──────────────────
  const prepared = prepareWrite(action, body.payload);
  if (!prepared.ok) return NextResponse.json({ error: prepared.error }, { status: 422 });

  // Encrypt the create_project database password before it touches the staged payload.
  const stagedPayload: Record<string, unknown> = { ...prepared.payload };
  if (action === "create_project" && typeof stagedPayload.db_pass === "string") {
    stagedPayload.db_pass_encrypted = encrypt(stagedPayload.db_pass);
    delete stagedPayload.db_pass;
  }

  try {
    const staged = await stageConnectorAction({
      userId: user.id,
      subAgentRunId: body.subAgentRunId ?? null,
      connector: SUPABASE_CONNECTOR,
      action,
      payload: stagedPayload,
      // Owner-initiated stage: the connector scope is granted by the owner invoking this route.
      declaredScopes: [SUPABASE_CONNECTOR],
      title: prepared.title,
      preview: prepared.preview,
      kind: "build_action_approval",
    });
    return NextResponse.json({
      staged: true,
      inboxItemId: staged.inboxItemId,
      autoApproved: staged.autoApproved,
    });
  } catch (e) {
    if (e instanceof ConnectorScopeError) {
      return NextResponse.json({ error: e.userMessage }, { status: 403 });
    }
    throw e;
  }
}

// Validate the write payload + build the card title and the FULL (untruncated) preview. The preview
// becomes the card body, so the entire migration / seed SQL is shown verbatim — the owner's last
// line before an irreversible change. Never renders the database password.
function prepareWrite(
  action: SupabaseActionName,
  payload: Record<string, unknown>,
): { ok: true; payload: Record<string, unknown>; title: string; preview: string } | { ok: false; error: string } {
  switch (action) {
    case "create_project": {
      const name = str(payload.name) || "(unnamed)";
      const region = str(payload.region) || "us-east-1";
      const plan = str(payload.plan) || "free";
      const preview = [
        `Create a new Supabase project:`,
        `• Name: ${name}`,
        `• Region: ${region}`,
        `• Plan: ${plan}`,
        ``,
        `This provisions real infrastructure in your Supabase organization (it may carry a monthly cost on your bill).`,
      ].join("\n");
      return { ok: true, payload, title: `Create Supabase project "${name}"`, preview };
    }
    case "apply_migration": {
      const ref = str(payload.project_ref) || "(no project)";
      const sql = str(payload.sql);
      const preview = [
        `Apply this migration to ${ref}.`,
        `This is a one-time approval — a migration changes your live data layer and cannot be auto-approved.`,
        ``,
        `--- SQL ---`,
        sql,
      ].join("\n");
      return { ok: true, payload, title: `Apply migration to ${ref}`, preview };
    }
    case "seed_data": {
      const ref = str(payload.project_ref) || "(no project)";
      const sql = str(payload.sql);
      const warnings = destructiveSqlWarnings(sql);
      const header = warnings.length
        ? `Heads up — this seed also ${warnings.join(" and ")}.`
        : `This seeds rows into ${ref}.`;
      const preview = [header, ``, `--- SQL ---`, sql].join("\n");
      return { ok: true, payload, title: `Seed data into ${ref}`, preview };
    }
    case "run_sql_read_only":
    case "get_connection_string":
      // Reads never stage — handled inline above. Present only to keep the switch exhaustive.
      return { ok: false, error: `${action} is a read action and is not staged.` };
    default: {
      const _never: never = action;
      return { ok: false, error: `Unknown action: ${String(_never)}` };
    }
  }
}
