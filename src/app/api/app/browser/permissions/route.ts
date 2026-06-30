// GET  /api/app/browser/permissions — list the owner's per-domain rules + Trust-Ladder progress.
// POST /api/app/browser/permissions  { domain, decision, autoApprove } — upsert one rule. Enabling
//      autoApprove is REFUSED unless the domain has cleared the Trust Ladder (≥5 manual approvals),
//      enforced server-side so a crafted request can't unlock auto-approve early.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listDomainPermissions, upsertDomainPermission } from "@/lib/browser/permissions-db";
import { countManualApprovalsForDomain } from "@/lib/browser/actions-db";
import { registrableDomain, hostOf } from "@/lib/browser/domains";
import { canUnlockAutoApprove, approvalsUntilUnlock, TRUST_LADDER_THRESHOLD } from "@/lib/browser/trust-ladder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  domain: z.string().trim().min(1).max(253),
  decision: z.enum(["allow", "deny"]),
  autoApprove: z.boolean(),
});

/** Accept either a bare domain ("quickbooks.com") or a full URL and reduce it to the registrable domain. */
function normalizeDomain(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  // If it parses as a URL, take its host; otherwise treat the string itself as a host.
  const host = hostOf(trimmed) ?? hostOf(`https://${trimmed}`) ?? trimmed;
  const domain = registrableDomain(host);
  return domain || null;
}

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await listDomainPermissions(user.id);
  if (!list.ok) return NextResponse.json({ error: list.error }, { status: list.status });

  // Annotate each rule with its Trust-Ladder progress so the UI can offer/deny the auto-approve toggle.
  const permissions = await Promise.all(
    list.data.map(async (row) => {
      const approvals = await countManualApprovalsForDomain(user.id, row.domain);
      return {
        domain: row.domain,
        decision: row.decision,
        autoApprove: row.auto_approve,
        manualApprovals: approvals,
        unlockAvailable: canUnlockAutoApprove(approvals),
        approvalsUntilUnlock: approvalsUntilUnlock(approvals),
        updatedAt: row.updated_at,
      };
    }),
  );

  return NextResponse.json({ permissions, trustLadderThreshold: TRUST_LADDER_THRESHOLD });
}

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = upsertSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const domain = normalizeDomain(parsed.data.domain);
  if (!domain) return NextResponse.json({ error: "Could not parse a domain from that input." }, { status: 422 });

  // Trust-Ladder enforcement: auto-approve can only be enabled once the domain has cleared the ladder.
  if (parsed.data.autoApprove) {
    const approvals = await countManualApprovalsForDomain(user.id, domain);
    if (!canUnlockAutoApprove(approvals)) {
      return NextResponse.json(
        {
          error: `Auto-approve unlocks after ${TRUST_LADDER_THRESHOLD} manual approvals for ${domain}. You have ${approvals}.`,
          approvalsUntilUnlock: approvalsUntilUnlock(approvals),
        },
        { status: 409 },
      );
    }
  }

  const upserted = await upsertDomainPermission({
    ownerId: user.id,
    domain,
    decision: parsed.data.decision,
    // A deny rule can never carry auto-approve — force it off so the two can't contradict.
    autoApprove: parsed.data.decision === "deny" ? false : parsed.data.autoApprove,
  });
  if (!upserted.ok) return NextResponse.json({ error: upserted.error }, { status: upserted.status });

  return NextResponse.json({
    status: "saved",
    permission: {
      domain: upserted.data.domain,
      decision: upserted.data.decision,
      autoApprove: upserted.data.auto_approve,
    },
  });
}
