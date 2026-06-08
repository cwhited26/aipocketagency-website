// tools.ts — the chat agent's tool registry + dispatcher (PA v5 connector bridge).
//
// This is the missing bridge: the system prompt enumerates these tools, the model picks one via
// the text protocol (tool-protocol.ts), and this module runs it. Reads (list/search/get) execute
// INLINE here in the Next runtime — no Modal sub-agent, no approval gate, no PA_ORCHESTRATOR_ENABLED
// — and stream their result straight back into the chat. Writes (send/post/create) are staged to
// the Approval Inbox via the Wave B middleware (stageConnectorAction) and only fire on the owner's
// approval; we never pretend a write happened.
//
// The toolset is computed from the live inventory, so a user without Slack never sees — or can
// invoke — a Slack tool. Every failure is a typed result (never a silent catch).

import { fetchFileContent } from "@/lib/pa-brain";
import { fetchMemoryIndex } from "@/lib/pa-brain-index";
import { gmailListRecent, gmailSearch, type GmailReadMessage } from "@/lib/connectors/gmail/read";
import { runCalendarAction } from "@/lib/connectors/calendar";
import { executeSlackAction } from "@/lib/connectors/slack/execute";
import { stageConnectorAction } from "@/lib/orchestrator/tool-use";
import { ConnectorScopeError } from "@/lib/orchestrator/containment-guard";
import { orchestratorEnabled } from "@/lib/orchestrator/feature-flag";
import { OrchestratorDbError } from "@/lib/orchestrator/db";
import type { ChatInventory, ChatConnector } from "./connection-inventory";
import { hasConnector } from "./connection-inventory";

const INBOX_HREF = "/app/apps/inbox";

// ── Tool catalog ────────────────────────────────────────────────────────────────────────────

export type ToolKind = "read" | "write";

export type ToolSpec = {
  id: string;
  kind: ToolKind;
  // The connector a write stages against (omitted for brain / read-only helpers).
  connector?: ChatConnector;
  // The exact action name passed to the connector's executor / approval middleware (writes).
  action?: string;
  // One-line signature shown in the system prompt, e.g. "connector.gmail.search(query, n?)".
  signature: string;
  // What the tool does — also shown in the prompt.
  description: string;
};

// Always-on tools (gated only on a connected brain repo).
const BRAIN_TOOLS: ToolSpec[] = [
  {
    id: "brain.read",
    kind: "read",
    signature: "brain.read(path)",
    description: "Read any file in the owner's brain repo by repo-relative path.",
  },
  {
    id: "brain.search",
    kind: "read",
    signature: "brain.search(query)",
    description: "Search the brain's indexed memory files by keyword; returns matching files.",
  },
];

// Per-connector tools, surfaced only when that connector is live.
const CONNECTOR_TOOLS: Record<ChatConnector, ToolSpec[]> = {
  gmail: [
    {
      id: "connector.gmail.list_recent",
      kind: "read",
      signature: "connector.gmail.list_recent(n?)",
      description: "List the n most recent inbox messages (from / subject / snippet).",
    },
    {
      id: "connector.gmail.search",
      kind: "read",
      signature: "connector.gmail.search(query, n?)",
      description: 'Search Gmail (Gmail query syntax, e.g. "from:patrick is:unread").',
    },
    {
      id: "connector.gmail.send",
      kind: "write",
      connector: "gmail",
      action: "send",
      signature: "connector.gmail.send(to, subject, body)",
      description: "Send an email AS the owner. Staged for approval before it sends.",
    },
  ],
  calendar: [
    {
      id: "connector.calendar.list_events",
      kind: "read",
      signature: "connector.calendar.list_events(time_min?, time_max?, max_results?)",
      description: "List upcoming events from the connected Google Calendar.",
    },
    {
      id: "connector.calendar.create_event",
      kind: "write",
      connector: "calendar",
      action: "create_event",
      signature: "connector.calendar.create_event(title, start, end, attendees?, description?)",
      description: "Create a calendar event. Staged for approval before it's created.",
    },
  ],
  slack: [
    {
      id: "connector.slack.list_channels",
      kind: "read",
      signature: "connector.slack.list_channels(limit?)",
      description: "List Slack channels the connected app can see.",
    },
    {
      id: "connector.slack.list_recent_messages",
      kind: "read",
      signature: "connector.slack.list_recent_messages(channel, limit?)",
      description: "Read recent messages in a Slack channel for context.",
    },
    {
      id: "connector.slack.post_message",
      kind: "write",
      connector: "slack",
      action: "post_message",
      signature: "connector.slack.post_message(channel, text)",
      description: "Post a message to a Slack channel. Staged for approval before it posts.",
    },
  ],
};

/** The tools available to a user, given what they've actually connected. */
export function buildToolset(inventory: ChatInventory): ToolSpec[] {
  const tools: ToolSpec[] = [];
  if (inventory.brainRepo) tools.push(...BRAIN_TOOLS);
  for (const provider of ["gmail", "calendar", "slack"] as const) {
    if (hasConnector(inventory, provider)) tools.push(...CONNECTOR_TOOLS[provider]);
  }
  return tools;
}

// ── Execution ─────────────────────────────────────────────────────────────────────────────────

export type ToolRunResult = {
  status: "ok" | "error" | "staged";
  // Card title, e.g. "Checked your Gmail".
  label: string;
  // One-line outcome for the card.
  summary: string;
  // Multi-line preview (read results / staged write) for the card.
  detail?: string;
  openHref?: string;
  // What the LLM sees as the tool result on the next turn (bounded length).
  forModel: string;
};

const MODEL_RESULT_CAP = 4_000;

function clampForModel(text: string): string {
  return text.length > MODEL_RESULT_CAP ? `${text.slice(0, MODEL_RESULT_CAP)}\n…(truncated)` : text;
}

// Safe input coercion (no `any`).
function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asNumber(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

function unavailable(id: string): ToolRunResult {
  return {
    status: "error",
    label: "Tool unavailable",
    summary: `${id} isn't connected for this account.`,
    forModel: `ERROR: ${id} is not available — that Connection isn't set up. Tell the owner how to connect it in Settings → Connections.`,
  };
}

function formatGmail(messages: GmailReadMessage[]): string {
  if (messages.length === 0) return "No matching messages.";
  return messages
    .map((m, i) => `${i + 1}. ${m.from || "(unknown sender)"} — ${m.subject || "(no subject)"}\n   ${m.snippet}`)
    .join("\n");
}

async function runGmailRead(
  userId: string,
  label: string,
  result: Awaited<ReturnType<typeof gmailListRecent>>,
): Promise<ToolRunResult> {
  if (!result.ok) {
    return {
      status: "error",
      label,
      summary: result.error,
      forModel: `ERROR: ${result.error}`,
    };
  }
  const detail = formatGmail(result.messages);
  return {
    status: "ok",
    label,
    summary: `Found ${result.messages.length} message${result.messages.length === 1 ? "" : "s"}.`,
    detail,
    forModel: clampForModel(`Gmail returned ${result.messages.length} message(s):\n${detail}`),
  };
}

/**
 * Run one tool call. Reads execute inline and return their data; writes are staged for approval.
 * Throws nothing — every path returns a typed ToolRunResult.
 */
export async function executeTool(
  userId: string,
  inventory: ChatInventory,
  call: { tool: string; input: Record<string, unknown> },
): Promise<ToolRunResult> {
  const spec = buildToolset(inventory).find((t) => t.id === call.tool);
  if (!spec) return unavailable(call.tool);

  try {
    if (spec.kind === "write") return await stageWrite(userId, inventory, spec, call.input);
    return await runRead(userId, inventory, spec, call.input);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected tool failure";
    return {
      status: "error",
      label: spec.id,
      summary: message,
      forModel: `ERROR running ${spec.id}: ${message}`,
    };
  }
}

async function runRead(
  userId: string,
  inventory: ChatInventory,
  spec: ToolSpec,
  input: Record<string, unknown>,
): Promise<ToolRunResult> {
  switch (spec.id) {
    case "brain.read": {
      const path = asString(input.path).trim();
      if (!path) {
        return { status: "error", label: "Read brain", summary: "No path given.", forModel: "ERROR: brain.read needs a `path`." };
      }
      const repo = inventory.brainRepo;
      if (!repo) return unavailable(spec.id);
      const content = await fetchFileContent(repo, path, inventory.brainToken);
      if (!content) {
        return {
          status: "error",
          label: `Read ${path}`,
          summary: "File not found or empty.",
          forModel: `ERROR: brain.read could not read ${path} (missing or empty).`,
        };
      }
      const preview = content.length > 1_500 ? `${content.slice(0, 1_500)}\n…` : content;
      return {
        status: "ok",
        label: `Read ${path}`,
        summary: `Read ${path} (${content.length} chars).`,
        detail: preview,
        forModel: clampForModel(`Contents of ${path}:\n${content}`),
      };
    }
    case "brain.search": {
      const query = asString(input.query).trim().toLowerCase();
      const rows = await fetchMemoryIndex(userId);
      const terms = query.split(/\s+/).filter(Boolean);
      const matched = (terms.length === 0 ? rows : rows.filter((r) => {
        const hay = `${r.name ?? ""} ${r.description ?? ""} ${r.body_excerpt ?? ""}`.toLowerCase();
        return terms.some((t) => hay.includes(t));
      })).slice(0, 8);
      if (matched.length === 0) {
        return {
          status: "ok",
          label: "Searched brain",
          summary: "No matching memory files.",
          forModel: "brain.search returned no matches.",
        };
      }
      const lines = matched.map((r) => `• ${r.name ?? r.path} — ${r.description ?? "(no description)"} [${r.path}]`).join("\n");
      return {
        status: "ok",
        label: "Searched brain",
        summary: `Found ${matched.length} matching file${matched.length === 1 ? "" : "s"}.`,
        detail: lines,
        forModel: clampForModel(`brain.search matches:\n${lines}`),
      };
    }
    case "connector.gmail.list_recent": {
      const n = asNumber(input.n ?? input.limit, 5);
      return runGmailRead(userId, "Checked your Gmail", await gmailListRecent(userId, n));
    }
    case "connector.gmail.search": {
      const query = asString(input.query);
      const n = asNumber(input.n ?? input.limit, 5);
      return runGmailRead(userId, "Searched your Gmail", await gmailSearch(userId, query, n));
    }
    case "connector.calendar.list_events": {
      const payload: Record<string, unknown> = {};
      if (asString(input.time_min)) payload.time_min = asString(input.time_min);
      if (asString(input.time_max)) payload.time_max = asString(input.time_max);
      payload.max_results = asNumber(input.max_results, 10);
      const res = await runCalendarAction({ userId, action: "list_events", payload, requestId: `chat-read-${userId}` });
      if (!res.ok) {
        return { status: "error", label: "Checked your Calendar", summary: res.error, forModel: `ERROR: ${res.error}` };
      }
      const events = Array.isArray(res.data.events) ? res.data.events : [];
      const detail = events.length
        ? events
            .map((e, i) => {
              const ev = e as { summary?: string; start?: string; end?: string; location?: string | null };
              return `${i + 1}. ${ev.summary ?? "(no title)"} — ${ev.start ?? "?"} → ${ev.end ?? "?"}${ev.location ? ` @ ${ev.location}` : ""}`;
            })
            .join("\n")
        : "No upcoming events in that window.";
      return {
        status: "ok",
        label: "Checked your Calendar",
        summary: `Found ${events.length} event${events.length === 1 ? "" : "s"}.`,
        detail,
        forModel: clampForModel(`Calendar returned ${events.length} event(s):\n${detail}`),
      };
    }
    case "connector.slack.list_channels": {
      const limit = asNumber(input.limit, 200);
      const res = await executeSlackAction({ userId, action: "list_channels", payload: { limit } });
      if (!res.ok) {
        return { status: "error", label: "Listed Slack channels", summary: res.error, forModel: `ERROR: ${res.error}` };
      }
      const channels = Array.isArray((res.data as { channels?: unknown }).channels)
        ? ((res.data as { channels: { name?: string | null; id: string }[] }).channels)
        : [];
      const detail = channels.length
        ? channels.map((c) => `#${c.name ?? c.id}`).join(", ")
        : "No channels visible to the app.";
      return {
        status: "ok",
        label: "Listed Slack channels",
        summary: res.summary,
        detail,
        forModel: clampForModel(`Slack channels: ${detail}`),
      };
    }
    case "connector.slack.list_recent_messages": {
      const channel = asString(input.channel);
      if (!channel) {
        return { status: "error", label: "Read Slack channel", summary: "No channel given.", forModel: "ERROR: connector.slack.list_recent_messages needs a `channel`." };
      }
      const limit = asNumber(input.limit, 20);
      const res = await executeSlackAction({ userId, action: "list_recent_messages", payload: { channel, limit } });
      if (!res.ok) {
        return { status: "error", label: "Read Slack channel", summary: res.error, forModel: `ERROR: ${res.error}` };
      }
      const messages = Array.isArray((res.data as { messages?: unknown }).messages)
        ? ((res.data as { messages: { user?: string | null; text?: string }[] }).messages)
        : [];
      const detail = messages.length
        ? messages.map((m, i) => `${i + 1}. ${m.user ?? "?"}: ${m.text ?? ""}`).join("\n")
        : "No recent messages.";
      return {
        status: "ok",
        label: "Read Slack channel",
        summary: res.summary,
        detail,
        forModel: clampForModel(`Slack messages in ${channel}:\n${detail}`),
      };
    }
    default:
      return unavailable(spec.id);
  }
}

// ── Write staging (Wave B Approval Inbox) ───────────────────────────────────────────────────────

function writePreview(spec: ToolSpec, input: Record<string, unknown>): { title: string; preview: string } {
  switch (spec.id) {
    case "connector.gmail.send": {
      const to = asString(input.to) || "(no recipient)";
      const subject = asString(input.subject) || "(no subject)";
      const body = asString(input.body);
      return { title: `Email ${to} — ${subject}`, preview: `To: ${to}\nSubject: ${subject}\n\n${body}` };
    }
    case "connector.calendar.create_event": {
      const t = asString(input.title) || "(untitled)";
      const start = asString(input.start);
      const end = asString(input.end);
      return { title: `Create event — ${t}`, preview: `${t}\n${start} → ${end}` };
    }
    case "connector.slack.post_message": {
      const channel = asString(input.channel) || "(no channel)";
      const text = asString(input.text);
      return { title: `Post to ${channel}`, preview: `#${channel}: ${text}` };
    }
    default:
      return { title: spec.id, preview: JSON.stringify(input).slice(0, 500) };
  }
}

async function stageWrite(
  userId: string,
  inventory: ChatInventory,
  spec: ToolSpec,
  input: Record<string, unknown>,
): Promise<ToolRunResult> {
  if (!spec.connector || !spec.action) return unavailable(spec.id);
  if (!hasConnector(inventory, spec.connector)) return unavailable(spec.id);

  const { title, preview } = writePreview(spec, input);
  // Honest notice when the autonomous runtime is off: the action is still queued and runs
  // in-process on approval, but we never imply it already fired.
  const runtimeOffNote = orchestratorEnabled()
    ? ""
    : "\n\n(The Wave B runtime is off — this is queued in your Approval Inbox and will run when you approve it.)";

  try {
    await stageConnectorAction({
      userId,
      subAgentRunId: null,
      connector: spec.connector,
      action: spec.action,
      // Bare connector scope → the action guard grants this action (chat-initiated, owner-blessed).
      declaredScopes: [spec.connector],
      payload: input,
      title,
      preview,
    });
  } catch (e) {
    if (e instanceof ConnectorScopeError) {
      return { status: "error", label: title, summary: e.userMessage, forModel: `ERROR: ${e.userMessage}` };
    }
    if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) {
      const msg = "The Approval Inbox isn't provisioned yet (migration 021 pending). I couldn't queue that write.";
      return { status: "error", label: title, summary: msg, forModel: `ERROR: ${msg}` };
    }
    const message = e instanceof Error ? e.message : "Could not stage the action.";
    return { status: "error", label: title, summary: message, forModel: `ERROR: ${message}` };
  }

  return {
    status: "staged",
    label: title,
    summary: "Queued for your approval.",
    detail: `${preview}${runtimeOffNote}`,
    openHref: INBOX_HREF,
    forModel:
      `STAGED: this write is now waiting in the owner's Approval Inbox. Do NOT claim it was sent/posted/created. ` +
      `Tell the owner it's queued and they can approve it in the Inbox.`,
  };
}
