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
  | "lead_scout_batch"
  | "build_action_approval"
  | "cost_budget_gate"
  | "skill_evolution_proposal"
  | "gate_findings"
  | "follow_up_sweep_batch"
  | "capture_triage_proposal"
  | "ritual_result"
  | "ritual_paused"
  | "persona_memory_proposal"
  | "soul_attribute_proposal"
  | "browser_action_approval"
  | "website_alert"
  | "agent_builder_proposal"
  | "signal_catcher_ritual_proposal";
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
  // Google Maps sweep framing (Phase 2) — null on a url_list batch.
  sweepKind: "google_maps" | null;
  category: string;
  location: string;
  noWebsiteCount: number;
};

// Skills (PA-SKILL-3): a proposed Skill write the LEARN phase staged. Carries the full proposed
// SKILL.md body so the owner reviews exactly what would be saved (the primary poisoning defense —
// a poisoned line is human-readable here). action='new' creates a Skill; 'update' sharpens one.
export type SkillProposalDetail = {
  action: "new" | "update";
  slug: string;
  name: string;
  proposedBody: string;
  proposedDescription: string;
  currentVersion: number;
  reason: string;
};

// Gate Phase: a held Project plan its gates flagged/blocked (kind='gate_findings'). The compact
// per-gate summary is carried on the inbox payload so the card + per-gate detail render without a
// second read; the full rows live in pa_gate_findings.
export type GateFindingDetail = {
  rule_violated: string;
  rule_source: string;
  plan_task_violating: string;
  severity: "low" | "medium" | "high" | "critical";
  suggested_fix: string;
  evidence: string;
} | null;

export type GateCardGate = {
  name: string;
  label: string;
  status: "pass" | "flag" | "hard_fail" | "error";
  finding: GateFindingDetail;
  overridable: boolean;
};

export type GateFindingsDetail = {
  projectId: string;
  planVersion: number;
  projectTitle: string;
  verdict: "flagged" | "blocked";
  gates: GateCardGate[];
};

// Persona Memory (PA-MEM-3): a sub-threshold memory write the LEARN phase staged. Carries the full
// proposed memory so the owner reads exactly what would be saved (the importance-inflation +
// poisoning defense — a poisoned line is human-readable here). partition/tier are owner-friendly on
// the card; importance shows what the classifier judged.
export type MemoryProposalDetail = {
  personaId: string;
  personaName: string;
  partition: string;
  tier: string;
  body: string;
  importance: number;
  untrustedOrigin: boolean;
};

export type SoulProposalDetail = {
  personaId: string;
  personaName: string;
  kind: string;
  summary: string;
  body: string | null;
};

// Custom Agent Builder (PA-POS-27): the whole composed agent staged as one approval card. The
// compact detail drives the card; the full ComposedAgent stays on the payload for the approve
// callback. The owner may edit personaName + starterPrompt inline before approving.
export type AgentBuildProposalDetail = {
  buildId: string;
  personaName: string;
  starterPrompt: string;
  apps: string[];
  skillSlugs: string[];
  brainScopes: string[];
  schedule: string | null;
  candidateSkill: { slug: string; name: string; body: string } | null;
};

// Signal Catcher (PA-SIGNAL-1): a caught standing wish proposed as a Ritual. The owner may edit
// the name + cadence inline before approving; Edit deep-links the pre-filled Ritual wizard.
export type SignalProposalDetail = {
  signalCatchId: string;
  quote: string;
  ritualName: string;
  cadenceText: string;
  cadenceSummary: string;
  appSlug: string;
  appLabel: string;
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
  skillProposal: SkillProposalDetail | null;
  gate: GateFindingsDetail | null;
  memoryProposal: MemoryProposalDetail | null;
  soulProposal: SoulProposalDetail | null;
  agentBuild: AgentBuildProposalDetail | null;
  signalProposal: SignalProposalDetail | null;
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
  "follow-up-sweeps": "Follow-Up Sweeps",
  "agent-builder": "Agent Builder",
  "signal-catcher": "Signal Catcher",
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
    sweepKind: str(item.payload.sweepKind) === "google_maps" ? "google_maps" : null,
    category: str(item.payload.category),
    location: str(item.payload.location),
    noWebsiteCount: num(item.payload.noWebsiteCount),
  };
}

function skillProposalOf(item: InboxItem): SkillProposalDetail {
  const action = item.payload.action === "update" ? "update" : "new";
  return {
    action,
    slug: str(item.payload.slug),
    name: str(item.payload.name) || item.title,
    proposedBody: str(item.payload.proposedBody),
    proposedDescription: str(item.payload.proposedDescription),
    currentVersion: num(item.payload.currentVersion),
    reason: str(item.payload.reason),
  };
}

function memoryProposalOf(item: InboxItem): MemoryProposalDetail {
  return {
    personaId: str(item.payload.personaId),
    personaName: str(item.payload.personaName) || "Your assistant",
    partition: str(item.payload.partition),
    tier: str(item.payload.tier),
    body: str(item.payload.body),
    importance: num(item.payload.importance),
    untrustedOrigin: item.payload.untrustedOrigin === true,
  };
}

function soulProposalOf(item: InboxItem): SoulProposalDetail {
  return {
    personaId: str(item.payload.personaId),
    personaName: str(item.payload.personaName) || "Your assistant",
    kind: str(item.payload.kind),
    summary: str(item.payload.summary),
    body: str(item.payload.body) || null,
  };
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

// Defensive read of the agent_builder_proposal payload (payload.composed is the full
// ComposedAgent staged by lib/agent-builder/stage-approval.ts).
function agentBuildOf(item: InboxItem): AgentBuildProposalDetail {
  const composed = (item.payload.composed ?? {}) as Record<string, unknown>;
  const rawCandidate = composed.candidateSkill;
  let candidateSkill: AgentBuildProposalDetail["candidateSkill"] = null;
  if (rawCandidate && typeof rawCandidate === "object") {
    const c = rawCandidate as Record<string, unknown>;
    candidateSkill = { slug: str(c.slug), name: str(c.name), body: str(c.body) };
  }
  return {
    buildId: str(item.payload.buildId) || str(composed.buildId),
    personaName: str(composed.personaName) || item.title,
    starterPrompt: str(composed.starterPrompt),
    apps: strArray(composed.apps),
    skillSlugs: strArray(composed.skillSlugs),
    brainScopes: strArray(composed.brainScopes),
    schedule: str(composed.schedule) || null,
    candidateSkill,
  };
}

// Defensive read of the signal_catcher_ritual_proposal payload (staged by
// lib/signal-catcher/catch.ts; the approve route re-parses it through Zod before acting).
function signalProposalOf(item: InboxItem): SignalProposalDetail {
  return {
    signalCatchId: str(item.payload.signalCatchId),
    quote: str(item.payload.quote),
    ritualName: str(item.payload.ritualName) || item.title,
    cadenceText: str(item.payload.cadenceText),
    cadenceSummary: str(item.payload.cadenceSummary),
    appSlug: str(item.payload.appSlug),
    appLabel: str(item.payload.appLabel),
  };
}

type GateSeverity = "low" | "medium" | "high" | "critical";
function severityOf(v: unknown): GateSeverity {
  return v === "low" || v === "high" || v === "critical" ? v : "medium";
}

// Normalizes the gate_findings payload (the compact summary staged on the inbox item). Shape is
// validated defensively — a malformed payload yields an empty gate list rather than throwing.
function gateOf(item: InboxItem): GateFindingsDetail {
  const p = item.payload as Record<string, unknown>;
  const rawGates = Array.isArray(p.gates) ? (p.gates as unknown[]) : [];
  const gates: GateCardGate[] = rawGates.flatMap((g) => {
    if (!g || typeof g !== "object") return [];
    const o = g as Record<string, unknown>;
    const status = str(o.status);
    if (status !== "pass" && status !== "flag" && status !== "hard_fail" && status !== "error") return [];
    const f = o.finding;
    let finding: GateFindingDetail = null;
    if (f && typeof f === "object") {
      const fo = f as Record<string, unknown>;
      finding = {
        rule_violated: str(fo.rule_violated),
        rule_source: str(fo.rule_source),
        plan_task_violating: str(fo.plan_task_violating),
        severity: severityOf(fo.severity),
        suggested_fix: str(fo.suggested_fix),
        evidence: str(fo.evidence),
      };
    }
    return [{ name: str(o.name), label: str(o.label) || str(o.name), status, finding, overridable: o.overridable === true }];
  });
  return {
    projectId: str(p.projectId),
    planVersion: num(p.planVersion) || 1,
    projectTitle: str(p.projectTitle) || item.title,
    verdict: str(p.verdict) === "blocked" ? "blocked" : "flagged",
    gates,
  };
}

function normalizeInboxItem(item: InboxItem): InboxCard {
  const isEmail = item.kind === "draft" && item.source === "email-drafter";
  const isTriage = item.kind === "email_triage";
  // The productivity (action_approval), build (build_action_approval), and browser
  // (browser_action_approval) connector kinds all carry a connector/action detail and render via the
  // same ActionApprovalCard.
  const isAction =
    item.kind === "action_approval" ||
    item.kind === "build_action_approval" ||
    item.kind === "browser_action_approval";
  const body = item.body_md ?? "";
  const triage = isTriage ? triageOf(item) : null;
  const action = isAction ? actionOf(item) : null;
  const leadScout = item.kind === "lead_scout_batch" ? leadScoutOf(item) : null;
  const skillProposal = item.kind === "skill_evolution_proposal" ? skillProposalOf(item) : null;
  const gate = item.kind === "gate_findings" ? gateOf(item) : null;
  const memoryProposal = item.kind === "persona_memory_proposal" ? memoryProposalOf(item) : null;
  const soulProposal = item.kind === "soul_attribute_proposal" ? soulProposalOf(item) : null;
  const agentBuild = item.kind === "agent_builder_proposal" ? agentBuildOf(item) : null;
  const signalProposal =
    item.kind === "signal_catcher_ritual_proposal" ? signalProposalOf(item) : null;
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
    skillProposal,
    gate,
    memoryProposal,
    soulProposal,
    agentBuild,
    signalProposal,
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
    skillProposal: null,
    gate: null,
    memoryProposal: null,
    soulProposal: null,
    agentBuild: null,
    signalProposal: null,
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
