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

import { fetchFileContent, listRepoTree } from "@/lib/pa-brain";
import { fetchMemoryIndex } from "@/lib/pa-brain-index";
import {
  gmailListRecent,
  gmailSearch,
  resolveGmailAccess,
  type GmailReadMessage,
} from "@/lib/connectors/gmail/read";
import {
  GmailDraftInputSchema,
  execute as createGmailDraftAction,
} from "@/lib/connectors/gmail/actions/create_draft";
import { hasGmailSendScope } from "@/lib/gmail";
import { runCalendarAction } from "@/lib/connectors/calendar";
import { runCalendlyAction } from "@/lib/connectors/calendly";
import { executeSlackAction } from "@/lib/connectors/slack/execute";
import { executeZoomAction } from "@/lib/connectors/zoom";
import { stageConnectorAction } from "@/lib/orchestrator/tool-use";
import { ConnectorScopeError } from "@/lib/orchestrator/containment-guard";
import { orchestratorEnabled } from "@/lib/orchestrator/feature-flag";
import { OrchestratorDbError } from "@/lib/orchestrator/db";
import type { ChatInventory, ChatConnector, LiveConnector } from "./connection-inventory";
import { hasConnector } from "./connection-inventory";

const INBOX_HREF = "/app/apps/inbox";
// Deep link to the owner's Gmail Drafts (the Gmail API draft id isn't a URL-addressable
// compose key, so we link the folder rather than a specific draft).
const GMAIL_DRAFTS_URL = "https://mail.google.com/mail/u/0/#drafts";

// ── Tool catalog ────────────────────────────────────────────────────────────────────────────

// read   — runs inline, returns data, no side effect.
// action — runs inline like a read but performs a side effect that needs no approval
//          (e.g. create a Gmail draft: the owner can delete it from Gmail, nothing sent).
// write  — staged to the Approval Inbox and only fires on the owner's approval.
export type ToolKind = "read" | "action" | "write";

export type ToolSpec = {
  id: string;
  kind: ToolKind;
  // The connector a write/action runs against (omitted for brain / read-only helpers).
  connector?: ChatConnector;
  // The exact action name passed to the connector's executor / approval middleware (writes).
  action?: string;
  // One-line signature shown in the system prompt, e.g. "connector.gmail.search(query, n?)".
  signature: string;
  // What the tool does — also shown in the prompt.
  description: string;
  // Optional per-connection annotation shown in the prompt, e.g. a "needs re-auth" hint
  // for a send action when the gmail.send scope isn't granted. Computed in buildToolset
  // from the live connection's scope/error state — never hides the tool, just flags it.
  note?: string;
};

// Always-on tools (gated only on a connected brain repo). The brain repo IS a GitHub repo, read via
// the owner's stored GitHub token — these are the agent's live GitHub-read capability, distinct from
// the not-yet-shipped general GitHub Connection. The system prompt makes that distinction explicit.
const BRAIN_TOOLS: ToolSpec[] = [
  {
    id: "brain.list",
    kind: "read",
    signature: "brain.list(path?)",
    description:
      "List files and folders in the owner's brain repo on GitHub (optionally under a path prefix).",
  },
  {
    id: "brain.read",
    kind: "read",
    signature: "brain.read(path)",
    description: "Read any file in the owner's brain repo on GitHub by repo-relative path.",
  },
  {
    id: "brain.search",
    kind: "read",
    signature: "brain.search(query)",
    description: "Search the brain's indexed memory files (on GitHub) by keyword; returns matching files.",
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
      id: "connector.gmail.create_draft",
      kind: "action",
      connector: "gmail",
      action: "create_draft",
      signature:
        "connector.gmail.create_draft(to, subject, body_text|body_html, cc?, bcc?, in_reply_to?, thread_id?)",
      description:
        "Create a draft in the owner's Gmail Drafts folder. Different from send — it stays a " +
        "draft until the owner sends it from Gmail. Runs immediately; no approval needed.",
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
      description:
        "Create an event on the owner's Google Calendar. Use this for INTERNAL meetings (the owner " +
        "controls everyone's time), or for an external prospect when Calendly ISN'T connected. " +
        "For an external prospect WITH Calendly connected, prefer connector.calendly.create_one_off_link " +
        "instead. Staged for approval before it's created.",
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
  zoom: [
    {
      id: "connector.zoom.list_upcoming_meetings",
      kind: "read",
      signature: "connector.zoom.list_upcoming_meetings(page_size?)",
      description: "List the owner's upcoming Zoom meetings (topic / start / join link).",
    },
    {
      id: "connector.zoom.get_meeting_link",
      kind: "read",
      signature: "connector.zoom.get_meeting_link(meeting_id)",
      description:
        "Get the join link (join_url) for a specific Zoom meeting — use this when you need a link " +
        "to put into an email or a calendar invite.",
    },
    {
      id: "connector.zoom.create_meeting",
      kind: "write",
      connector: "zoom",
      action: "create_meeting",
      signature:
        "connector.zoom.create_meeting(topic, start_time, duration_minutes|end_time, agenda?, timezone?, auto_recording?)",
      description:
        "Schedule a Zoom meeting and get its join link. Staged for approval before it's created. " +
        "To put a Zoom call on a calendar invite: call this first, then pass the returned join_url " +
        "into connector.calendar.create_event's description.",
    },
  ],
  calendly: [
    {
      id: "connector.calendly.list_event_types",
      kind: "read",
      signature: "connector.calendly.list_event_types(active_only?, count?)",
      description:
        "List the owner's Calendly meeting types (e.g. '30 min intro call', 'Site visit') — what " +
        "a prospect can book. Use this first to find the right event_type_uri for a booking link.",
    },
    {
      id: "connector.calendly.list_scheduled_events",
      kind: "read",
      signature: "connector.calendly.list_scheduled_events(min_start_time?, max_start_time?, count?)",
      description: "List what's actually booked on the owner's Calendly (who's coming, when).",
    },
    {
      id: "connector.calendly.create_one_off_link",
      kind: "write",
      connector: "calendly",
      action: "create_one_off_link",
      signature: "connector.calendly.create_one_off_link(event_type_uri, max_event_count?)",
      description:
        "Generate a single-use Calendly booking link for a specific meeting type — the link you " +
        "send a prospect so they self-book. PREFER THIS over connector.calendar.create_event when " +
        "the meeting is with an EXTERNAL prospect and Calendly is connected (the prospect picks " +
        "their own time). Pair it with a drafted email containing the link. Staged for approval " +
        "before the link is minted.",
    },
  ],
};

// Per-connection re-auth annotation for a Gmail tool. Never hides the tool — it surfaces
// either way; this just tells the model (and the owner) when an action needs a fresh grant.
function annotateGmail(spec: ToolSpec, conn: LiveConnector): ToolSpec {
  const notes: string[] = [];
  if (conn.needsReauth) {
    notes.push(
      "Gmail is flagged for reconnect — I'll try anyway and relay a reconnect hint if the grant is dead.",
    );
  }
  // Only SENDING needs the incremental gmail.send scope; reads + drafts don't. An empty
  // scopes list means an old grant that predates send tracking, so treat it as not-granted.
  if (spec.id === "connector.gmail.send" && !hasGmailSendScope(conn.scopes)) {
    notes.push(
      "the send scope isn't granted yet — reads + drafts still work; reconnect Gmail in " +
        "Settings → Connections to enable sending.",
    );
  }
  if (notes.length === 0) return spec;
  return { ...spec, note: notes.join(" ") };
}

/** The tools available to a user, given what they've actually connected. */
export function buildToolset(inventory: ChatInventory): ToolSpec[] {
  const tools: ToolSpec[] = [];
  if (inventory.brainRepo) tools.push(...BRAIN_TOOLS);
  for (const provider of ["gmail", "calendar", "slack", "zoom", "calendly"] as const) {
    const conn = inventory.connectors.find((c) => c.provider === provider);
    if (!conn) continue;
    const specs = CONNECTOR_TOOLS[provider];
    tools.push(...(provider === "gmail" ? specs.map((s) => annotateGmail(s, conn)) : specs));
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

// Models often pass a single recipient as a bare string ("a@b.com") or a comma/semicolon
// list instead of the array the schema wants. Coerce to an array so a well-formed call
// isn't rejected on a shape technicality; leave non-strings (incl. real arrays) untouched.
function coerceRecipients(v: unknown): unknown {
  if (typeof v !== "string") return v;
  return v
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
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
 * Run one tool call. Reads and no-approval actions (create_draft) execute inline and return
 * their data; writes are staged for approval. Throws nothing — every path returns a typed
 * ToolRunResult.
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
    return await runInline(userId, inventory, spec, call.input);
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

async function runInline(
  userId: string,
  inventory: ChatInventory,
  spec: ToolSpec,
  input: Record<string, unknown>,
): Promise<ToolRunResult> {
  switch (spec.id) {
    case "brain.list": {
      const repo = inventory.brainRepo;
      if (!repo) return unavailable(spec.id);
      const prefix = asString(input.path).trim().replace(/^\/+|\/+$/g, "");
      const tree = await listRepoTree(repo, inventory.brainToken);
      if (tree.length === 0) {
        return {
          status: "error",
          label: "Listed brain files",
          summary: "Couldn't list the brain repo (empty or unreachable).",
          forModel: "ERROR: brain.list returned nothing — the repo is empty or the GitHub token can't read it.",
        };
      }
      const entries = prefix
        ? tree.filter((e) => e.path === prefix || e.path.startsWith(`${prefix}/`))
        : tree;
      const scoped = entries.slice(0, 200);
      const lines = scoped.map((e) => `${e.type === "tree" ? "dir " : "file"} ${e.path}`).join("\n");
      const where = prefix ? ` under ${prefix}` : "";
      const more = entries.length > scoped.length ? `\n…(${entries.length - scoped.length} more)` : "";
      return {
        status: "ok",
        label: "Listed brain files",
        summary: `${entries.length} entr${entries.length === 1 ? "y" : "ies"}${where} in ${repo}.`,
        detail: `${lines}${more}`,
        forModel: clampForModel(`brain.list (${repo})${where} — ${entries.length} entries:\n${lines}${more}`),
      };
    }
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
    case "connector.gmail.create_draft":
      return runCreateDraft(userId, input);
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
    case "connector.zoom.list_upcoming_meetings": {
      const payload: Record<string, unknown> = { page_size: asNumber(input.page_size ?? input.limit, 10) };
      const res = await executeZoomAction({ userId, action: "list_upcoming_meetings", payload, ownerEmail: null });
      if (!res.ok) {
        return { status: "error", label: "Checked your Zoom", summary: res.error, forModel: `ERROR: ${res.error}` };
      }
      const meetings = Array.isArray((res.data as { meetings?: unknown }).meetings)
        ? (res.data as { meetings: { topic?: string; start?: string; joinUrl?: string | null }[] }).meetings
        : [];
      const detail = meetings.length
        ? meetings
            .map((m, i) => `${i + 1}. ${m.topic ?? "(no topic)"} — ${m.start ?? "?"}${m.joinUrl ? `\n   ${m.joinUrl}` : ""}`)
            .join("\n")
        : "No upcoming Zoom meetings.";
      return {
        status: "ok",
        label: "Checked your Zoom",
        summary: `Found ${meetings.length} upcoming meeting${meetings.length === 1 ? "" : "s"}.`,
        detail,
        forModel: clampForModel(`Zoom returned ${meetings.length} upcoming meeting(s):\n${detail}`),
      };
    }
    case "connector.zoom.get_meeting_link": {
      const meetingId = asString(input.meeting_id);
      if (!meetingId) {
        return { status: "error", label: "Zoom meeting link", summary: "No meeting_id given.", forModel: "ERROR: connector.zoom.get_meeting_link needs a `meeting_id`." };
      }
      const res = await executeZoomAction({ userId, action: "get_meeting_link", payload: { meeting_id: meetingId }, ownerEmail: null });
      if (!res.ok) {
        return { status: "error", label: "Zoom meeting link", summary: res.error, forModel: `ERROR: ${res.error}` };
      }
      const joinUrl = typeof (res.data as { joinUrl?: unknown }).joinUrl === "string"
        ? (res.data as { joinUrl: string }).joinUrl
        : null;
      return {
        status: "ok",
        label: "Zoom meeting link",
        summary: joinUrl ? "Found the join link." : "No join link on that meeting.",
        detail: joinUrl ?? undefined,
        forModel: joinUrl ? `Zoom join link for meeting ${meetingId}: ${joinUrl}` : `Meeting ${meetingId} has no join link.`,
      };
    }
    case "connector.calendly.list_event_types": {
      const payload: Record<string, unknown> = {};
      if (input.active_only !== undefined) payload.active_only = Boolean(input.active_only);
      payload.count = asNumber(input.count ?? input.n, 25);
      const res = await runCalendlyAction({
        userId,
        action: "list_event_types",
        payload,
        ownerEmail: null,
      });
      if (!res.ok) {
        return { status: "error", label: "Checked your Calendly", summary: res.error, forModel: `ERROR: ${res.error}` };
      }
      const types = Array.isArray(res.data.eventTypes) ? res.data.eventTypes : [];
      const detail = types.length
        ? types
            .map((t, i) => {
              const et = t as { name?: string; uri?: string; active?: boolean; duration?: number | null };
              const dur = typeof et.duration === "number" ? ` (${et.duration} min)` : "";
              const off = et.active === false ? " [inactive]" : "";
              return `${i + 1}. ${et.name ?? "(untitled)"}${dur}${off}\n   ${et.uri ?? ""}`;
            })
            .join("\n")
        : "No meeting types found.";
      return {
        status: "ok",
        label: "Checked your Calendly",
        summary: `Found ${types.length} meeting type${types.length === 1 ? "" : "s"}.`,
        detail,
        forModel: clampForModel(
          `Calendly meeting types (${types.length}). Use a uri as event_type_uri for create_one_off_link:\n${detail}`,
        ),
      };
    }
    case "connector.calendly.list_scheduled_events": {
      const payload: Record<string, unknown> = {};
      if (asString(input.min_start_time)) payload.min_start_time = asString(input.min_start_time);
      if (asString(input.max_start_time)) payload.max_start_time = asString(input.max_start_time);
      payload.count = asNumber(input.count, 20);
      const res = await runCalendlyAction({
        userId,
        action: "list_scheduled_events",
        payload,
        ownerEmail: null,
      });
      if (!res.ok) {
        return { status: "error", label: "Checked your Calendly bookings", summary: res.error, forModel: `ERROR: ${res.error}` };
      }
      const events = Array.isArray(res.data.events) ? res.data.events : [];
      const detail = events.length
        ? events
            .map((e, i) => {
              const ev = e as { name?: string; start?: string | null; status?: string | null };
              return `${i + 1}. ${ev.name ?? "(untitled)"} — ${ev.start ?? "?"}${ev.status ? ` [${ev.status}]` : ""}`;
            })
            .join("\n")
        : "No bookings in that window.";
      return {
        status: "ok",
        label: "Checked your Calendly bookings",
        summary: `Found ${events.length} booking${events.length === 1 ? "" : "s"}.`,
        detail,
        forModel: clampForModel(`Calendly bookings (${events.length}):\n${detail}`),
      };
    }
    default:
      return unavailable(spec.id);
  }
}

// ── Inline action: create a Gmail draft (no approval) ─────────────────────────────────────────────
// A draft has no real-world side effect (nothing is sent; the owner can delete it from Gmail),
// so it runs inline like a read rather than staging to the Approval Inbox. Resolves a fresh
// access token (self-healing an errored connection), validates the input, creates the draft,
// and returns an "ok" card linking to the owner's Gmail Drafts.
async function runCreateDraft(
  userId: string,
  input: Record<string, unknown>,
): Promise<ToolRunResult> {
  const access = await resolveGmailAccess(userId);
  if (!access.ok) {
    return { status: "error", label: "Create Gmail draft", summary: access.error, forModel: `ERROR: ${access.error}` };
  }

  const normalizedInput: Record<string, unknown> = {
    ...input,
    to: coerceRecipients(input.to),
    ...(input.cc !== undefined ? { cc: coerceRecipients(input.cc) } : {}),
    ...(input.bcc !== undefined ? { bcc: coerceRecipients(input.bcc) } : {}),
  };
  const parsed = GmailDraftInputSchema.safeParse(normalizedInput);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid draft input.";
    return {
      status: "error",
      label: "Create Gmail draft",
      summary: msg,
      forModel: `ERROR: connector.gmail.create_draft — ${msg}`,
    };
  }

  const res = await createGmailDraftAction({
    accessToken: access.token,
    fromEmail: access.email,
    input: parsed.data,
  });
  if (!res.ok) {
    const hint = res.authError ? " Reconnect Gmail in Settings → Connections." : "";
    return {
      status: "error",
      label: "Create Gmail draft",
      summary: `${res.error}${hint}`,
      forModel: `ERROR creating draft: ${res.error}${hint}`,
    };
  }

  const detail = `To: ${res.to.join(", ")}\nSubject: ${res.subject}`;
  return {
    status: "ok",
    label: "Draft created in Gmail",
    summary: `Saved a draft to ${res.to.join(", ")} in your Gmail Drafts.`,
    detail,
    openHref: GMAIL_DRAFTS_URL,
    forModel:
      `DRAFT CREATED: Gmail draft ${res.draftId} to ${res.to.join(", ")} (subject "${res.subject}"). ` +
      `It is in the owner's Drafts folder — NOT sent. Tell the owner it's ready to review and send from Gmail.`,
  };
}

// ── Write staging (Wave B Approval Inbox) ───────────────────────────────────────────────────────

function writePreview(
  spec: ToolSpec,
  input: Record<string, unknown>,
  inventory: ChatInventory,
): { title: string; preview: string } {
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
      // Cross-connector composition (task item 6): when Zoom is connected, the calendar lane adds a
      // Zoom join link to this event on approval (composeZoomForEvent), so the preview says so. The
      // link itself is generated when the event is created — covered by this single approval.
      const zoomLine =
        hasConnector(inventory, "zoom") && !asString(input.description).includes("zoom.us")
          ? "\n+ A Zoom meeting link will be created and added on approval."
          : "";
      return { title: `Create event — ${t}`, preview: `${t}\n${start} → ${end}${zoomLine}` };
    }
    case "connector.slack.post_message": {
      const channel = asString(input.channel) || "(no channel)";
      const text = asString(input.text);
      return { title: `Post to ${channel}`, preview: `#${channel}: ${text}` };
    }
    case "connector.zoom.create_meeting": {
      const topic = asString(input.topic) || "(untitled)";
      const start = asString(input.start_time);
      const duration = asNumber(input.duration_minutes, 0);
      const when = duration > 0 ? `${start} for ${duration} min` : start;
      return { title: `Create Zoom meeting — ${topic}`, preview: `${topic}\n${when}` };
    }
    case "connector.calendly.create_one_off_link": {
      const which = asString(input.event_type_name) || asString(input.event_type_uri) || "(no meeting type)";
      const max = asNumber(input.max_event_count, 1);
      return {
        title: `Calendly booking link — ${which}`,
        preview:
          `Meeting type: ${which}\n` +
          (max === 1 ? "Single-use link (expires after one booking)." : `Bookable up to ${max} times.`),
      };
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

  const { title, preview } = writePreview(spec, input, inventory);
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
