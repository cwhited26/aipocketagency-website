import { createClient } from "@/lib/supabase/server";
import {
  listInboxItems,
  createInboxItem,
  type InboxItem,
} from "@/lib/pa-inbox-items";
import { listActionsForUser, type PendingAction } from "@/lib/pa-actions";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Normalized card shape shared with the Inbox client ───────────────────────

export type InboxCardSystem = "inbox" | "legacy";
export type InboxCardKind =
  | "draft"
  | "decision"
  | "email_triage"
  | "persona_lead"
  | "action_approval"
  | "sub_agent_activity"
  | "routine_output"
  | "lead_scout_batch";
export type InboxCardStatus = "pending" | "approved" | "rejected" | "expired" | "failed";

export type TriageDetail = {
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  url: string;
  receivedAt: string | null;
  // RFC 2822 Message-ID of the triaged message, captured at sync time. A reply
  // drafted from this thread passes it as in_reply_to so the send threads correctly.
  inReplyTo: string;
};

// PA v5 Wave B: connector write-action staged for one-tap approval (kind='action_approval').
export type ActionApprovalDetail = {
  connector: string;
  action: string;
  subAgentRunId: string | null;
};

// Lead Scout: a finished scrape batch (kind='lead_scout_batch'). Counts + CSV link + a link into the
// backing Project workspace; the breakdown drives the classification chips on the card.
export type LeadScoutBatchDetail = {
  runId: string;
  sourceName: string;
  projectId: string | null;
  leadCount: number;
  breakdown: { hot: number; warm: number; cold: number; wrong_fit: number; needs_research: number };
  csvPath: string;
  runPath: string;
};

export type InboxCard = {
  id: string;
  system: InboxCardSystem;
  kind: InboxCardKind;
  status: InboxCardStatus;
  title: string;
  source: string;
  preview: string;
  bodyMd: string;
  createdAt: string;
  resolvedAt: string | null;
  email: { to: string; subject: string; body: string } | null;
  triage: TriageDetail | null;
  action: ActionApprovalDetail | null;
  leadScout: LeadScoutBatchDetail | null;
  // The surface the draft was initiated from. 'inbox' means it was drafted from
  // within the Inbox (a reply to a triaged thread) and is rendered inline on its
  // originating thread instead of in the generic drafts list. threadId links it back.
  sourceSurface: string | null;
  threadId: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  "email-drafter": "Email Drafter",
  "voice-memo": "Voice Memo",
  "auto-suggest": "Auto-suggest",
  gmail: "Gmail",
  routine: "Routine",
};

function previewOf(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function triageOf(item: InboxItem): TriageDetail {
  const receivedAt = item.payload.receivedAt;
  return {
    threadId: str(item.payload.threadId),
    from: str(item.payload.from),
    subject: str(item.payload.subject),
    snippet: str(item.payload.snippet),
    url: str(item.payload.url),
    receivedAt: typeof receivedAt === "string" ? receivedAt : null,
    inReplyTo: str(item.payload.rfcMessageId),
  };
}

function actionOf(item: InboxItem): ActionApprovalDetail {
  const runId = item.payload.subAgentRunId;
  return {
    connector: str(item.payload.connector),
    action: str(item.payload.action),
    subAgentRunId: typeof runId === "string" ? runId : null,
  };
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function leadScoutOf(item: InboxItem): LeadScoutBatchDetail {
  const b = (item.payload.breakdown ?? {}) as Record<string, unknown>;
  return {
    runId: str(item.payload.runId),
    sourceName: str(item.payload.sourceName) || item.title,
    projectId: str(item.payload.projectId) || null,
    leadCount: num(item.payload.leadCount),
    breakdown: {
      hot: num(b.hot),
      warm: num(b.warm),
      cold: num(b.cold),
      wrong_fit: num(b.wrong_fit),
      needs_research: num(b.needs_research),
    },
    csvPath: str(item.payload.csvPath),
    runPath: str(item.payload.runPath),
  };
}

function normalizeInboxItem(item: InboxItem): InboxCard {
  const isEmail = item.kind === "draft" && item.source === "email-drafter";
  const isTriage = item.kind === "email_triage";
  const isAction = item.kind === "action_approval";
  const body = item.body_md ?? "";
  const triage = isTriage ? triageOf(item) : null;
  const action = isAction ? actionOf(item) : null;
  const leadScout = item.kind === "lead_scout_batch" ? leadScoutOf(item) : null;
  return {
    id: item.id,
    system: "inbox",
    kind: item.kind,
    status: item.status,
    title: item.title,
    source: item.source ? (SOURCE_LABELS[item.source] ?? item.source) : "Agent",
    preview: previewOf(triage ? triage.snippet || item.title : body || item.title),
    bodyMd: body,
    createdAt: item.created_at,
    resolvedAt: item.resolved_at,
    email: isEmail
      ? {
          to: str(item.payload.to),
          subject: str(item.payload.subject),
          body: str(item.payload.body) || body,
        }
      : null,
    triage,
    action,
    leadScout,
    sourceSurface: str(item.payload.sourceSurface) || null,
    threadId: str(item.payload.threadId) || null,
  };
}

// Legacy pocket_agent_pending_actions (the Phase-3c brain-memory approval gate)
// are surfaced so they don't disappear from the Inbox. Their execution still runs
// through /api/app/actions/[id]/approve|reject. A brain-memory proposal is a draft
// (Approve to commit); a routine_output is informational (read it, never approve it),
// so it carries the routine_output kind even though the cron now writes new outputs
// straight to pa_inbox_items.
function normalizeLegacyAction(action: PendingAction): InboxCard {
  const statusMap: Record<PendingAction["status"], InboxCardStatus> = {
    pending: "pending",
    approved: "approved",
    executing: "approved",
    executed: "approved",
    rejected: "rejected",
    failed: "failed",
  };
  const content = str(action.payload.content) || action.summary;
  const isRoutine = action.action_type === "routine_output";
  return {
    id: action.id,
    system: "legacy",
    kind: isRoutine ? "routine_output" : "draft",
    status: statusMap[action.status],
    title: action.title,
    source: isRoutine ? "Routine" : "Auto-suggest",
    preview: previewOf(action.summary || content),
    bodyMd: content,
    createdAt: action.created_at,
    resolvedAt: action.decided_at,
    email: null,
    triage: null,
    action: null,
    leadScout: null,
    sourceSurface: null,
    threadId: null,
  };
}

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [inboxResult, legacyResult] = await Promise.all([
    listInboxItems(user.id),
    listActionsForUser(user.id),
  ]);

  if (!inboxResult.ok) {
    return NextResponse.json({ error: inboxResult.error }, { status: inboxResult.status });
  }

  const cards: InboxCard[] = inboxResult.data.map(normalizeInboxItem);
  // Legacy is best-effort: if its table read fails we still render the new Inbox.
  if (legacyResult.ok) {
    cards.push(...legacyResult.data.map(normalizeLegacyAction));
  }

  cards.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({
    cards,
    provisioned: inboxResult.degraded !== "table_missing",
  });
}

// ─── Create a draft (Email Drafter is the only client-side producer) ──────────

const createSchema = z.object({
  to: z.string().max(200).optional().default(""),
  subject: z.string().max(300).optional().default(""),
  body: z.string().min(1).max(20_000),
  citations: z
    .array(z.object({ file: z.string(), line: z.string() }))
    .optional()
    .default([]),
  // Reply threading context, carried from the source Gmail thread so an approved
  // draft sends back into the original conversation (connector.gmail.send).
  threadId: z.string().max(200).optional().default(""),
  inReplyTo: z.string().max(500).optional().default(""),
  // Which surface initiated this draft. 'inbox' = drafted from within the Inbox
  // (a reply to a triaged thread) — the Inbox renders it inline on its thread
  // rather than burying it in the generic drafts list. Everything else stages
  // normally. Defaults to the Email Drafter app.
  sourceSurface: z
    .enum(["inbox", "email-app", "capture", "voice", "persona", "slash"])
    .optional()
    .default("email-app"),
});

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

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const { to, subject, body, citations, threadId, inReplyTo, sourceSurface } = parsed.data;
  const trimmedSubject = subject.trim();
  const trimmedTo = to.trim();
  const title =
    trimmedSubject || (trimmedTo ? `Email to ${trimmedTo}` : "Drafted email");

  const payload: Record<string, unknown> = {
    to: trimmedTo,
    subject: trimmedSubject,
    body,
    citations,
    sourceSurface,
  };
  if (threadId.trim()) payload.threadId = threadId.trim();
  if (inReplyTo.trim()) payload.inReplyTo = inReplyTo.trim();

  const result = await createInboxItem({
    userId: user.id,
    kind: "draft",
    title,
    bodyMd: body,
    source: "email-drafter",
    payload,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ item: result.data }, { status: 201 });
}
