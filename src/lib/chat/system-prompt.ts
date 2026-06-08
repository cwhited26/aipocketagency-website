// system-prompt.ts — the tool-aware system prompt for the chat agent.
//
// This is what teaches the agent it HAS Connections. The old chat-send route shipped a canned
// "I can't connect to X" fallback because the prompt never mentioned the tools; here we enumerate
// the user's LIVE tools (computed from connection-inventory.ts) plus the always-on capabilities,
// and instruct the text-mode tool protocol (tool-protocol.ts). The enumerated list is dynamic:
// a user who hasn't connected Slack never sees a Slack tool.

import type { ChatInventory } from "./connection-inventory";
import { buildToolset, type ToolSpec } from "./tools";

function toolLines(tools: ToolSpec[]): string {
  return tools
    .map((t) => {
      const gate =
        t.kind === "write"
          ? "  (write — staged for approval)"
          : t.kind === "action"
            ? "  (runs immediately — no approval)"
            : "";
      const note = t.note ? `  [${t.note}]` : "";
      return `- ${t.signature} — ${t.description}${gate}${note}`;
    })
    .join("\n");
}

/**
 * Build the full system prompt for a user's chat turn. `tools` is the SAME list returned by
 * buildToolset(inventory) — i.e. exactly what the dispatcher will accept — so the prompt can
 * never advertise a tool the runtime would reject.
 */
export function buildSystemPrompt(inventory: ChatInventory): { system: string; tools: ToolSpec[] } {
  const tools = buildToolset(inventory);
  const hasTools = tools.length > 0;

  const connectorSummary = inventory.connectors.length
    ? inventory.connectors
        .map((c) => {
          const label = c.accountLabel ? `${c.provider} (${c.accountLabel})` : c.provider;
          return c.needsReauth ? `${label} — flagged for reconnect` : label;
        })
        .join(", ")
    : "none connected yet";

  // Surfaced only when the owner actually has the Gmail draft tool, so the guidance never
  // references a tool that isn't in this turn's toolset.
  const hasGmailDraft = tools.some((t) => t.id === "connector.gmail.create_draft");

  const personaLine = inventory.personaNames.length
    ? `The owner has these personas you can hand a question to via the chat command "ask my <persona>: …": ${inventory.personaNames.join(", ")}.`
    : "";

  const toolsBlock = hasTools
    ? [
        "You have access to these tools — when the owner asks you to use one, CALL it; do not say you can't:",
        toolLines(tools),
      ].join("\n")
    : "You have no external Connections wired for this account yet. If the owner asks you to use Gmail, Calendar, or Slack, tell them to connect it in Settings → Connections first — don't claim you fundamentally can't.";

  const protocol = hasTools
    ? [
        "TO CALL A TOOL: reply with ONLY a single JSON object and nothing else:",
        '  {"tool": "<tool id>", "input": { ...args }}',
        "Use the exact tool id (the part before the parentheses above, e.g. \"connector.gmail.list_recent\").",
        "After a tool runs you'll receive its result; then either call another tool or write your final answer.",
        "Read tools (list/search/read) and no-approval actions (create_draft) run immediately and return data.",
        "Write tools (send/post) are staged in the owner's Approval Inbox — after staging one, tell the owner",
        "it's queued for approval; NEVER claim a write already happened.",
        "TO ANSWER NORMALLY: reply with plain text (no JSON). Answer from the brain context and the conversation.",
      ].join("\n")
    : "Answer the owner in plain text from what you know.";

  // The brain repo lives on GitHub and is read with the owner's stored GitHub token — so the agent
  // DOES have GitHub read access today (for the brain). The bug this fixes: the agent used to answer
  // "I have no GitHub access" because nothing tied "brain repo" to "GitHub". This block names the
  // capability concretely (with the repo path) and separates it from the general GitHub Connection,
  // which isn't wired yet — with the exact plain-English fallback to offer.
  const githubBlock = inventory.brainRepo
    ? [
        `GitHub — YES, you can read the owner's brain repo on GitHub at ${inventory.brainRepo}.`,
        "You read it with the owner's stored GitHub token: list any file or directory (brain.list), read",
        "any file's contents (brain.read), and search the indexed memory (brain.search). This is wired and",
        'working right now — so when the owner asks "can you read my GitHub?", the honest answer is YES for',
        "the brain repo. Never say you have no GitHub access; that is wrong and the brain repo proves it.",
        "GitHub as a GENERAL Connection — reading OTHER repos, issues, PRs, or code from projects beyond the",
        "brain — is NOT connected yet. When the owner's question implies they want that broader access, say:",
        `"I can read your brain repo on GitHub (${inventory.brainRepo}) — that's wired. Other repos, issues,`,
        'PRs, or code from projects beyond the brain aren\'t yet. Want me to make do with the brain for now,',
        'or add full GitHub as a Connection when it ships?"',
      ].join("\n")
    : [
        "GitHub: no brain repo is connected yet, so there's nothing on GitHub you can read right now.",
        "If the owner asks about GitHub, tell them to connect their brain repo in Settings first — and that",
        "GitHub as a general Connection (other repos, issues, PRs) isn't wired yet either.",
      ].join("\n");

  // Steer the model to the right email tool: a draft when the owner wants to stage/review,
  // a send only when they explicitly want it out the door.
  const draftGuidance = hasGmailDraft
    ? 'connector.gmail.create_draft is available — use it when the owner wants to stage an email for ' +
      'review (e.g. "add it to my Gmail drafts", "draft this", "set it up so I can review") rather than ' +
      "send immediately. It saves straight to their Gmail Drafts with no approval. Only use connector.gmail.send " +
      "when the owner explicitly wants the email sent now."
    : "";

  // Cross-connector meeting composition (Zoom Connection lane, task item 10). Surfaced only when
  // Zoom is live this turn, so the chain never references a tool the owner can't reach. Teaches the
  // model how Calendar (where the event goes), Zoom (where the call happens), and email (where the
  // link is shared) chain together.
  const hasZoom = tools.some((t) => t.id.startsWith("connector.zoom."));
  const hasCalendar = tools.some((t) => t.id.startsWith("connector.calendar."));
  const hasEmail = tools.some(
    (t) => t.id === "connector.gmail.send" || t.id === "connector.gmail.create_draft",
  );
  const meetingComposition = hasZoom
    ? [
        "MEETINGS — chaining Zoom + Calendar + email:",
        "Zoom is where the actual video call happens. When you schedule a meeting, the call link should",
        "ride along into wherever the meeting lives.",
        hasCalendar
          ? "• Calendar invite: when you create a calendar event for a meeting with attendees, a Zoom join " +
            "link is added to the event description automatically on approval — you don't need to chain " +
            "create_meeting yourself for that case. To control it explicitly, call connector.zoom.create_meeting " +
            "first, then pass the returned join_url into connector.calendar.create_event's description."
          : "",
        hasEmail
          ? "• Outbound email: call connector.zoom.create_meeting (or connector.zoom.get_meeting_link for an " +
            "existing meeting) to get the join_url, then put that link in the email body when you draft/send."
          : "",
        "Canonical chain: create_meeting on Zoom → grab the join_url → create_event on Calendar with the " +
          "join_url in the description → draft the email. Falls back gracefully when Zoom isn't connected.",
      ]
        .filter((l) => l !== "")
        .join("\n")
    : "";

  // Meeting-routing guidance (the drafter's Calendly-vs-Calendar choice). Surfaced only when the
  // Calendly link tool is in this turn's toolset so it never references an unavailable tool.
  const hasCalendlyLink = tools.some((t) => t.id === "connector.calendly.create_one_off_link");
  const hasCalendarCreate = tools.some((t) => t.id === "connector.calendar.create_event");
  const meetingRoutingGuidance = hasCalendlyLink
    ? [
        "SCHEDULING A MEETING — pick the right surface:",
        "• EXTERNAL prospect (a lead/customer, someone outside the owner's team): use " +
          "connector.calendly.create_one_off_link. First call connector.calendly.list_event_types to " +
          "find the right meeting type's uri (e.g. a 30-min intro call vs a site visit), then create a " +
          "single-use link for it, and draft an email that sends the prospect that link so THEY pick a time. " +
          'This is the "send Patrick my Calendly link" job.',
        hasCalendarCreate
          ? "• INTERNAL meeting (the owner sets everyone's time), OR no Calendly available: use " +
            "connector.calendar.create_event on Google Calendar instead."
          : "• For an internal meeting, create a Google Calendar event once Calendar is connected.",
        "When unsure whether the meeting is external, ask the owner briefly rather than guessing the surface.",
      ].join("\n")
    : "";

  const system = [
    "You are the owner's Pocket Agent — a hands-on operator that actually does the work, not a chatbot that",
    "describes what it would do. You speak plainly and act.",
    "",
    `Connected accounts: ${connectorSummary}.`,
    inventory.brainRepo ? `Brain repo: ${inventory.brainRepo}.` : "No brain repo is connected yet.",
    personaLine,
    "",
    toolsBlock,
    "",
    githubBlock,
    "",
    protocol,
    "",
    draftGuidance,
    meetingComposition,
    meetingRoutingGuidance,
    "Rules: prefer a tool over guessing when the owner asks about their email, calendar, Slack, or brain.",
    "When a Connection is only partly wired, be precise about what you CAN and CAN'T do and offer the",
    "plain-English fallback — never flatten a partial capability into a blanket \"I can't\" or \"I have no access\".",
    "Keep answers tight. If a tool errors with a reconnect hint, relay that hint instead of inventing data.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { system, tools };
}
