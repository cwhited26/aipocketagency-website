import { createClient } from "@/lib/supabase/server";
import {
  fetchInboxItemById,
  resolveInboxItem,
  type InboxItem,
} from "@/lib/pa-inbox-items";
import { ensureFreshAccessToken, hasGmailSendScope } from "@/lib/gmail";
import {
  fetchGmailConnectionFull,
  markGmailConnectionError,
} from "@/lib/pa-gmail-connections";
import { execute as gmailSend, type GmailSendInput } from "@/lib/connectors/gmail/actions/send";
import { fetchPaUser } from "@/lib/pa-supabase";
import { acceptTriageProposal } from "@/lib/capture-inbox/triage";
import {
  CAPTURE_TRIAGE_PROPOSAL_KIND,
  isTriageBucket,
  type CaptureTriagePayload,
} from "@/lib/capture-inbox/types";
import { isBlueprintDecision, advanceAfterBlueprintApproval } from "@/lib/idea-engine/engine";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Inbox client may send the (possibly edited) recipient / subject / body so the
// final send honors any tweaks made in the card before approval. All optional — the
// stored draft payload is the source of truth when an override is absent.
const OverrideSchema = z.object({
  to: z.string().max(500).optional(),
  subject: z.string().max(500).optional(),
  body: z.string().max(50_000).optional(),
  // Capture Inbox triage proposals: the owner may edit the destination brain path and the bucket on
  // the card before approving.
  targetPath: z.string().max(300).optional(),
  bucket: z.string().max(40).optional(),
});

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// Split a comma/semicolon-separated recipient string into trimmed, non-empty addresses.
function parseRecipients(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((r) => r.trim())
    .filter(Boolean);
}

function isEmailDraft(item: InboxItem): boolean {
  return item.kind === "draft" && item.source === "email-drafter";
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  // Body is optional (decisions / legacy drafts approve with no payload).
  let override: z.infer<typeof OverrideSchema> = {};
  const rawBody = await req.json().catch(() => null);
  if (rawBody !== null) {
    const parsed = OverrideSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 422 });
    }
    override = parsed.data;
  }

  const found = await fetchInboxItemById(id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  const item = found.data;
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership gate (RLS is defense-in-depth; this is the real gate).
  if (item.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already resolved: the send (if any) already fired on the first approval. Don't
  // re-send — just report the terminal state so a stale tab settles.
  if (item.status === "approved") {
    return NextResponse.json({ status: "approved", sent: false, alreadyResolved: true });
  }
  if (item.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot approve an item that is '${item.status}'.` },
      { status: 409 },
    );
  }

  // Capture Inbox triage proposal (PA-CAPTURE-2): file the entry into the suggested (or owner-edited)
  // brain path, then prune it from memory/inbox.md via the cleanup pass. Nothing is sent.
  if (item.kind === CAPTURE_TRIAGE_PROPOSAL_KIND) {
    const pa = await fetchPaUser(user.id);
    if (!pa.ok || !pa.data || !pa.data.brain_repo || !pa.data.github_token) {
      return NextResponse.json(
        { error: "Connect your brain in Settings before filing captures." },
        { status: 409 },
      );
    }
    const payload = item.payload as unknown as CaptureTriagePayload;
    if (!payload || typeof payload.entryId !== "string") {
      return NextResponse.json(
        { error: "This proposal is missing its entry — nothing to file." },
        { status: 422 },
      );
    }
    const overrideBucket =
      typeof override.bucket === "string" && isTriageBucket(override.bucket)
        ? override.bucket
        : undefined;
    const accepted = await acceptTriageProposal({
      ctx: { repo: pa.data.brain_repo, token: pa.data.github_token },
      payload,
      overrideTargetPath: override.targetPath,
      overrideBucket,
    });
    if (!accepted.ok) return NextResponse.json({ error: accepted.error }, { status: 502 });

    const resolved = await resolveInboxItem(id, "approved", user.id);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    return NextResponse.json({ status: "approved", filed: true, path: accepted.path });
  }

  // Idea Engine blueprint (PA-IDEA-5): an approved MVP-plan `decision` card advances the idea from
  // stage 3 (blueprint) to stage 4 (build). Resolve the card, then advance — best-effort, the advance
  // never undoes the approval.
  const blueprint = item.kind === "decision" ? isBlueprintDecision(item.payload) : null;
  if (blueprint) {
    const resolved = await resolveInboxItem(id, "approved", user.id);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    await advanceAfterBlueprintApproval(user.id, blueprint.ideaId);
    return NextResponse.json({ status: "approved", sent: false, ideaAdvanced: true });
  }

  // Non-email items (decisions, legacy drafts): record approval, nothing to send.
  if (!isEmailDraft(item)) {
    const resolved = await resolveInboxItem(id, "approved", user.id);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    return NextResponse.json({ status: "approved", sent: false });
  }

  // ── Email draft: send live via the Gmail connector, AS the user ──────────────────
  const to = parseRecipients(override.to ?? str(item.payload.to));
  if (to.length === 0) {
    return NextResponse.json(
      { error: "Cannot send — recipient missing. This shouldn't happen — file a bug." },
      { status: 422 },
    );
  }

  const conn = await fetchGmailConnectionFull(user.id);
  if (!conn.ok) return NextResponse.json({ error: conn.error }, { status: conn.status });
  if (!conn.data || conn.data.status === "revoked") {
    return NextResponse.json(
      { error: "Connect Gmail in Settings → Connections to send replies." },
      { status: 409 },
    );
  }
  if (!hasGmailSendScope(conn.data.scopes)) {
    return NextResponse.json(
      {
        error:
          "Re-authorize Gmail to enable sending — Settings → Connections → Reconnect. " +
          "Your earlier connection didn't include send permission.",
      },
      { status: 403 },
    );
  }

  const token = await ensureFreshAccessToken(conn.data);
  if (!token.ok) {
    if (token.authError) await markGmailConnectionError(conn.data.id);
    return NextResponse.json(
      { error: "Gmail authorization expired — reconnect Gmail in Settings." },
      { status: 502 },
    );
  }

  const sendInput: GmailSendInput = {
    to,
    subject: override.subject ?? (str(item.payload.subject) || "(no subject)"),
    body_text: override.body ?? (str(item.payload.body) || item.body_md || ""),
    in_reply_to: str(item.payload.inReplyTo) || undefined,
    thread_id: str(item.payload.threadId) || undefined,
    from: conn.data.email ?? undefined,
  };

  const result = await gmailSend({
    accessToken: token.data,
    fromEmail: conn.data.email,
    input: sendInput,
  });
  if (!result.ok) {
    if (result.authError) await markGmailConnectionError(conn.data.id);
    // Leave the item pending so the user can retry / reconnect — nothing was sent.
    return NextResponse.json(
      { error: "Couldn't send the email through Gmail. Try again." },
      { status: 502 },
    );
  }

  // Sent — now record the approval.
  const resolved = await resolveInboxItem(id, "approved", user.id);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  return NextResponse.json({
    status: "approved",
    sent: true,
    messageId: result.messageId,
    threadId: result.threadId,
  });
}
