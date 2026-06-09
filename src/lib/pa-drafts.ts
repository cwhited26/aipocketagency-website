import { buildMemoryBlocks, parseCitations, listMemoryFiles } from "./pa-brain";
import type { Citation, MemoryBlock } from "./pa-brain";

function formatBlocks(blocks: MemoryBlock[]): string {
  return blocks
    .map(({ path, content }) => {
      const lines = content.split("\n");
      const numbered = lines.map((l, i) => `${i + 1}: ${l}`).join("\n");
      return `--- ${path} ---\n${numbered}`;
    })
    .join("\n\n");
}

function avatarNote(blocks: MemoryBlock[]): string {
  const hasAvatar = blocks.some((b) => b.path === "memory/customer-avatar.md");
  if (!hasAvatar) return "";
  return `\nCUSTOMER AVATAR: A customer-avatar.md is present in the brain. Read it carefully and condition ALL writing on that person — their language, concerns, and goals should be reflected in the output.\n`;
}

function buildQuoteSystemPrompt(
  memoryBlocks: MemoryBlock[],
  clientName: string,
  scopeDescription: string,
  specifics: string,
): string {
  const hasMemory = memoryBlocks.length > 0;
  const memorySection = hasMemory
    ? `BRAIN MEMORY FILES (your business context — services, pricing, voice, past decisions):\n${formatBlocks(memoryBlocks)}\n\n`
    : `NOTE: No brain memory files are connected yet. Draft the best quote you can from the inputs provided. At the end, list 2-3 specific things the user should add to their brain (services offered, standard pricing, terms of service, past client context) to make future quotes sharper and more personalized.\n\n`;
  const avatarLine = avatarNote(memoryBlocks);

  return `You are a skilled quote and proposal writer for an independent operator.
${avatarLine}
${memorySection}YOUR TASK:
Write a clean, professional quote/proposal for the following job. The output should sound like the operator wrote it — direct, specific, no filler — not like a template from a software package.

CLIENT: ${clientName}
SCOPE: ${scopeDescription}${specifics ? `\nADDITIONAL DETAILS: ${specifics}` : ""}

STRUCTURE THE QUOTE AS:
1. **Introduction** — one short paragraph. Who this is for, what it covers. No fluff.
2. **Scope of Work** — bulleted list of what's included. Specific line items derived from the scope description. If the brain has past project context, mirror the format used there.
3. **Investment** — pricing section. If the brain has pricing memory, use it. If not, write placeholder lines like "[PRICE — add your standard rate]" that the operator can fill in. Never invent numbers.
4. **Timeline** — if timeline info was provided, include it. Otherwise use "[TIMELINE]" placeholder.
5. **Terms** — 2-3 standard terms (payment schedule, revision rounds, what's excluded). Use brain terms if present; otherwise write sensible defaults.
6. **Next Step** — one sentence. What the client should do to move forward.

VOICE RULES:
- Write like the operator would write, not like a legal document or corporate proposal template.
- Short sentences. Specific language. No "I hope this finds you well," no "leveraging synergies," no filler.
- If the brain has a voice spec or communication style notes, follow them exactly.
- Every factual claim derived from memory must be cited: [memory/filename.md:line]
- If the brain doesn't have pricing or services info, still write a complete, useful draft — just use clear placeholders and note at the end what brain context would sharpen it.`;
}

function buildEmailSystemPrompt(
  memoryBlocks: MemoryBlock[],
  recipient: string,
  relationship: string,
  purpose: string,
  keyPoints: string,
  tone: string,
): string {
  const hasMemory = memoryBlocks.length > 0;
  const memorySection = hasMemory
    ? `BRAIN MEMORY FILES (the operator's business context, voice, communication style, client history):\n${formatBlocks(memoryBlocks)}\n\n`
    : `NOTE: No brain memory files are connected yet. Draft the best email you can from the inputs provided. At the end, note 2-3 specific things the user should add to their brain (voice spec, client communication patterns, relationship history) to make future email drafts more personalized and on-voice.\n\n`;
  const avatarLine = avatarNote(memoryBlocks);

  return `You are drafting an email on behalf of an independent operator. Your job is to write an email that sounds like THEM — not like a polished PR person, not like ChatGPT, not like a corporate account manager. Like them.
${avatarLine}

${memorySection}EMAIL CONTEXT:
TO: ${recipient}${relationship ? `\nRELATIONSHIP: ${relationship}` : ""}
PURPOSE: ${purpose}${keyPoints ? `\nKEY POINTS TO COVER:\n${keyPoints}` : ""}${tone ? `\nTONE NOTE: ${tone}` : ""}

VOICE RULES (apply these strictly):
- Read the brain's voice or communication style notes carefully. Write in that voice exactly.
- If no voice spec is in the brain, default to: short sentences, direct, specific, no padding. The kind of email a busy operator sends between jobs — not a carefully polished business letter.
- No "I hope this finds you well." No "circling back." No "just checking in." No "at your earliest convenience."
- Open with the first name or a single-line greeting that fits the relationship. Not "Hi [Name],"  — "Name —" or just the name if that's how they write.
- Frame the ask in the first sentence. Don't build up to it.
- Specific > vague. If the brain has context about the recipient, use it. Name the project, the date, the amount, the specific thing they discussed.
- Close with a single-action CTA. One thing. Not three options.
- Sign off as the operator does (check the brain for their sign-off pattern; default to "— [FirstName]" if not found).
- Every factual claim pulled from memory must be cited: [memory/filename.md:line]

STRUCTURE:
1. Greeting line (one line, no filler)
2. Purpose/ask — first sentence, direct
3. Body — key points, specific, short. Bullets if parallel items; prose if one continuous thought.
4. CTA — one action, one link, one decision
5. Sign-off

Output ONLY the email. No preamble, no "here's the draft:" wrapper. Start with the greeting line.`;
}

// Quick-draft mode: the operator types/speaks one line ("follow-up to Patrick
// about the quote and Thursday call") and the model infers recipient,
// relationship, purpose, key points, and tone itself before drafting — no manual
// field entry. Same voice rules as the structured path.
function buildEmailBriefSystemPrompt(memoryBlocks: MemoryBlock[], brief: string): string {
  const hasMemory = memoryBlocks.length > 0;
  const memorySection = hasMemory
    ? `BRAIN MEMORY FILES (the operator's business context, voice, communication style, client history):\n${formatBlocks(memoryBlocks)}\n\n`
    : `NOTE: No brain memory files are connected yet. Draft the best email you can from the one-line ask. At the end, note 2-3 specific things the user should add to their brain (voice spec, client communication patterns, relationship history) to make future email drafts more personalized and on-voice.\n\n`;
  const avatarLine = avatarNote(memoryBlocks);

  return `You are drafting an email on behalf of an independent operator. Your job is to write an email that sounds like THEM — not like a polished PR person, not like ChatGPT, not like a corporate account manager. Like them.
${avatarLine}

${memorySection}THE OPERATOR'S ONE-LINE ASK:
"${brief}"

FIRST, infer the email's structure from that one line plus anything the brain tells you:
- WHO it's to (recipient) and your RELATIONSHIP to them — use the brain to resolve names, history, and prior threads.
- The PURPOSE — what this email needs to accomplish.
- The KEY POINTS to cover — pull specifics (dates, amounts, project names, next steps) from the ask and the brain.
- The TONE that fits this recipient and relationship.
If the ask is ambiguous and the brain doesn't resolve it, make the most reasonable assumption a competent assistant would — do not ask the user questions, just write the email.

VOICE RULES (apply these strictly):
- Read the brain's voice or communication style notes carefully. Write in that voice exactly.
- If no voice spec is in the brain, default to: short sentences, direct, specific, no padding. The kind of email a busy operator sends between jobs — not a carefully polished business letter.
- No "I hope this finds you well." No "circling back." No "just checking in." No "at your earliest convenience."
- Open with the first name or a single-line greeting that fits the relationship. Not "Hi [Name]," — "Name —" or just the name if that's how they write.
- Frame the ask in the first sentence. Don't build up to it.
- Specific > vague. If the brain has context about the recipient, use it. Name the project, the date, the amount, the specific thing they discussed.
- Close with a single-action CTA. One thing. Not three options.
- Sign off as the operator does (check the brain for their sign-off pattern; default to "— [FirstName]" if not found).
- Every factual claim pulled from memory must be cited: [memory/filename.md:line]

STRUCTURE:
1. Greeting line (one line, no filler)
2. Purpose/ask — first sentence, direct
3. Body — key points, specific, short. Bullets if parallel items; prose if one continuous thought.
4. CTA — one action, one link, one decision
5. Sign-off

Output ONLY the email. No preamble, no "here's the draft:" wrapper, no restating the fields you inferred. Start with the greeting line.`;
}

type AnthropicTextBlock = { type: "text"; text: string };
type AnthropicApiResponse = { content: AnthropicTextBlock[] };

export async function generateQuoteDraft(
  params: {
    clientName: string;
    scopeDescription: string;
    specifics: string;
  },
  anthropicApiKey: string,
  brainRepo: string | null,
  githubToken: string | null,
): Promise<{ draft: string; citations: Citation[]; hasBrain: boolean }> {
  const memoryBlocks: MemoryBlock[] = brainRepo
    ? await buildMemoryBlocks(brainRepo, githubToken)
    : [];

  const systemPrompt = buildQuoteSystemPrompt(
    memoryBlocks,
    params.clientName,
    params.scopeDescription,
    params.specifics,
  );

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Generate the quote/proposal now. Format it cleanly for copy-paste or light editing. Don't add any preamble before the quote — start directly with the Introduction section.",
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic error: ${await res.text()}`);
  }

  const msg = (await res.json()) as AnthropicApiResponse;
  const draft = msg.content.find((c) => c.type === "text")?.text ?? "";
  return { draft, citations: parseCitations(draft), hasBrain: memoryBlocks.length > 0 };
}

function buildFollowUpsSystemPrompt(
  memoryBlocks: MemoryBlock[],
  context: string,
): string {
  const hasMemory = memoryBlocks.length > 0;
  const memorySection = hasMemory
    ? `BRAIN MEMORY FILES (your business context — clients, leads, relationships, past decisions):\n${formatBlocks(memoryBlocks)}\n\n`
    : `NOTE: No brain memory files are connected yet. Provide general follow-up advice from the inputs provided. Add a note explaining that connecting a brain will let the agent surface specific names, deals, and relationships that have gone cold.\n\n`;
  const avatarLine = avatarNote(memoryBlocks);

  const contextSection = context
    ? `USER CONTEXT: ${context}\n\n`
    : "";

  return `You are an AI assistant scanning a business owner's memory for relationships, clients, leads, and deals that may need a follow-up nudge.
${avatarLine}

${memorySection}${contextSection}YOUR TASK:
Read the brain memory carefully. Identify 3-5 specific people, clients, leads, or deals that:
- Haven't been mentioned as recently active or resolved
- Are in-progress but may have stalled
- Were mentioned as needing follow-up or a next step
- Represent open opportunities or unresolved loose ends

For each one, write:
1. **Name/Deal** — what it is, who it's with
2. **Why they're on the radar** — what the brain says about them
3. **Suggested nudge** — a short, direct draft message the operator can send. Write it the way the operator would write — direct, specific, not corporate. No "I hope this finds you well." No filler. Short.

If the brain has a voice spec, draft nudges in that voice. If no voice spec, default to: direct, short, specific — the way a busy operator texts between jobs.

Cite every claim with [memory/filename.md:line].

If there's no brain connected, describe 3 types of follow-up scenarios common to independent operators (clients awaiting a proposal, leads who went quiet, pending payments) and suggest what they'd draft.

FORMAT:
Use numbered items. Each item: bold name/deal header, one-sentence radar note, then the draft message in a blockquote-style indent. Keep drafts under 5 sentences.`;
}

function buildDailyBriefSystemPrompt(
  memoryBlocks: MemoryBlock[],
): string {
  const hasMemory = memoryBlocks.length > 0;
  const memorySection = hasMemory
    ? `BRAIN MEMORY FILES (your business context — clients, leads, pending items, decisions, knowledge):\n${formatBlocks(memoryBlocks)}\n\n`
    : `NOTE: No brain memory files are connected yet. Write a useful morning brief based on general independent-operator priorities. Add a clear note explaining that connecting a brain will make future briefs personalized and specific.\n\n`;
  const avatarLine = avatarNote(memoryBlocks);

  return `You are writing a morning briefing for an independent business operator. This is their agent's daily read — a sharp, useful summary of what's on the radar and what to prioritize today.
${avatarLine}

${memorySection}YOUR TASK:
Write a concise morning brief with the following sections. Keep each section tight — 2-5 bullets max. No filler. No fluff. The operator is reading this at 7am before their first call.

SECTIONS:
1. **On The Radar** — active clients, leads, or deals mentioned in the brain that need attention. For each: name + one-line status + what's needed.

2. **Pending Items** — anything explicitly flagged as pending, waiting for response, or needing action in the brain.

3. **Revenue Opportunity** — any open proposals, leads who could convert, or upsell moments visible in the brain.

4. **One Priority** — based on everything above, the single most important thing the operator should move on today. One sentence. Specific.

VOICE RULES:
- Terse and direct. Like a trusted advisor who knows your business.
- Every factual claim cited: [memory/filename.md:line]
- No greeting. No "Good morning, [Name]." Just start with the brief.
- If the brain is sparse, note what context would make the brief more useful, then write the best brief you can.`;
}

export async function generateFollowUpsDraft(
  params: { context: string },
  anthropicApiKey: string,
  brainRepo: string | null,
  githubToken: string | null,
): Promise<{ draft: string; citations: Citation[]; hasBrain: boolean }> {
  const memoryBlocks: MemoryBlock[] = brainRepo
    ? await buildMemoryBlocks(brainRepo, githubToken)
    : [];

  const systemPrompt = buildFollowUpsSystemPrompt(memoryBlocks, params.context);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Scan the brain and surface the follow-up items now. Start directly with item 1 — no preamble.",
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic error: ${await res.text()}`);
  }

  const msg = (await res.json()) as AnthropicApiResponse;
  const draft = msg.content.find((c) => c.type === "text")?.text ?? "";
  return { draft, citations: parseCitations(draft), hasBrain: memoryBlocks.length > 0 };
}

export async function generateDailyBrief(
  anthropicApiKey: string,
  brainRepo: string | null,
  githubToken: string | null,
): Promise<{ brief: string; citations: Citation[]; hasBrain: boolean }> {
  const memoryBlocks: MemoryBlock[] = brainRepo
    ? await buildMemoryBlocks(brainRepo, githubToken)
    : [];

  const systemPrompt = buildDailyBriefSystemPrompt(memoryBlocks);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1800,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Generate my morning brief now. Start directly with the first section.",
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic error: ${await res.text()}`);
  }

  const msg = (await res.json()) as AnthropicApiResponse;
  const brief = msg.content.find((c) => c.type === "text")?.text ?? "";
  return { brief, citations: parseCitations(brief), hasBrain: memoryBlocks.length > 0 };
}

function buildCalendarSystemPrompt(memoryBlocks: MemoryBlock[]): string {
  const hasMemory = memoryBlocks.length > 0;
  const memorySection = hasMemory
    ? `BRAIN MEMORY FILES (your business context — clients, jobs, schedules, deadlines, planned work):\n${formatBlocks(memoryBlocks)}\n\n`
    : `NOTE: No brain memory files are connected yet. Describe what kinds of upcoming items would normally appear for an independent operator (scheduled jobs, follow-up calls, proposal deadlines, payment dates) and suggest what context to add to the brain to populate this view.\n\n`;

  return `You are scanning a business owner's brain memory for anything date-related, scheduled, or time-sensitive.

${memorySection}YOUR TASK:
Extract and list every upcoming item, deadline, or time-sensitive thing mentioned in the brain. Include:
- Scheduled jobs, site visits, or project start dates
- Calls, meetings, or appointments mentioned
- Proposal or quote deadlines
- Follow-up timelines ("follow up next week", "call Thursday")
- Payment schedules or invoice due dates
- Anything with a relative or absolute date/time reference

FORMAT: Group by "This Week", "Next Week", and "Further Out" if dates are known. If dates are relative, note them as-is. For each item: one-line description + who/what it's with + source citation [memory/filename.md:line].

If nothing date-related is in the brain, say so clearly and suggest 3 types of context to add (e.g., scheduled jobs, pending follow-up timelines, proposal deadlines) to make this view useful.

Be honest about what you found — do not invent items or approximate vague references as specific dates.`;
}

export async function generateCalendarScan(
  anthropicApiKey: string,
  brainRepo: string | null,
  githubToken: string | null,
): Promise<{ brief: string; citations: Citation[]; hasBrain: boolean }> {
  const memoryBlocks: MemoryBlock[] = brainRepo
    ? await buildMemoryBlocks(brainRepo, githubToken)
    : [];

  const systemPrompt = buildCalendarSystemPrompt(memoryBlocks);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Scan the brain and list all upcoming and time-sensitive items now. Start directly with the results.",
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic error: ${await res.text()}`);
  }

  const msg = (await res.json()) as AnthropicApiResponse;
  const brief = msg.content.find((c) => c.type === "text")?.text ?? "";
  return { brief, citations: parseCitations(brief), hasBrain: memoryBlocks.length > 0 };
}

export async function generateEmailDraft(
  params: {
    recipient: string;
    relationship: string;
    purpose: string;
    keyPoints: string;
    tone: string;
    // When set (Quick mode), the model infers the structured fields from this
    // one-line ask itself and the recipient/purpose/etc. above are ignored.
    brief?: string;
  },
  anthropicApiKey: string,
  brainRepo: string | null,
  githubToken: string | null,
): Promise<{ draft: string; citations: Citation[]; hasBrain: boolean }> {
  const memoryBlocks: MemoryBlock[] = brainRepo
    ? await buildMemoryBlocks(brainRepo, githubToken)
    : [];

  const systemPrompt = params.brief
    ? buildEmailBriefSystemPrompt(memoryBlocks, params.brief)
    : buildEmailSystemPrompt(
        memoryBlocks,
        params.recipient,
        params.relationship,
        params.purpose,
        params.keyPoints,
        params.tone,
      );

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Write the email now. Start directly with the greeting line — no wrapper text, no \"here's your email.\"",
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic error: ${await res.text()}`);
  }

  const msg = (await res.json()) as AnthropicApiResponse;
  const draft = msg.content.find((c) => c.type === "text")?.text ?? "";
  return { draft, citations: parseCitations(draft), hasBrain: memoryBlocks.length > 0 };
}

// ─── Lead Scout outreach (Phase 3) ───────────────────────────────────────────────
//
// The cold/warm outreach drafter for a scraped Lead Scout lead. It reuses the exact same voice
// loader the Email Drafter uses (buildMemoryBlocks → the owner's brain memory + voice spec), so the
// owner's voice carries through with no duplicate loading. The only new input is the lead's profile
// and a tone hint. Unlike generateEmailDraft (which emits only a body), this one also emits a
// subject line — a cold email needs one — so it returns { subject, body, citations }.

export type OutreachTone = "cold-introduce" | "warm-followup" | "reactivate";

export type LeadOutreachContext = {
  /** The business / person we're reaching out to. */
  leadName: string;
  /** One-line "what they do" summary from the scrape. */
  leadSummary: string;
  /** The lead's structured profile fields (phone, website status, category, …) as plain strings. */
  leadProfile: Record<string, string>;
  /** The lead's URL or Maps listing — context for the model, never invented. */
  leadUrl: string;
  /** The Lead Source's name ("Knoxville no-website roofers") — what the owner is hunting for. */
  sourceName: string;
  tone: OutreachTone;
  /**
   * A vertical-specific voice hint from a Lead Scout pack (Phase 4) — what to lead with, what the
   * pain is for this trade, what the one ask should be. Steers the draft so a roofing email reads
   * roofing-specific and a law-firm email reads law-firm-specific. Absent for a hand-built source.
   */
  voiceBrief?: string;
};

const TONE_DIRECTION: Record<OutreachTone, string> = {
  "cold-introduce":
    "This is a COLD first-touch. You have never spoken. Lead with a specific, true observation about " +
    "THEIR business (pulled from the profile below — e.g. they have strong reviews but no website), then " +
    "make one concrete offer and one small ask. Never imply a prior relationship that doesn't exist.",
  "warm-followup":
    "This is a WARM follow-up — there has been prior contact. Reference the earlier touch lightly, then " +
    "move the conversation one step forward. Don't restart from scratch.",
  reactivate:
    "This is a RE-ACTIVATION of a lead that went quiet. Acknowledge the gap honestly without guilt-tripping, " +
    "give them a fresh, specific reason to re-engage now, and keep the ask tiny.",
};

function buildOutreachSystemPrompt(
  memoryBlocks: MemoryBlock[],
  ctx: LeadOutreachContext,
): string {
  const hasMemory = memoryBlocks.length > 0;
  const memorySection = hasMemory
    ? `BRAIN MEMORY FILES (the operator's business context, voice, communication style, what they sell):\n${formatBlocks(memoryBlocks)}\n\n`
    : `NOTE: No brain memory files are connected yet. Draft the best outreach you can from the lead profile. At the end, note 1-2 things the operator should add to their brain (what they sell, their voice spec) to sharpen future outreach.\n\n`;
  const avatarLine = avatarNote(memoryBlocks);

  const profileLines = Object.entries(ctx.leadProfile)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  return `You are drafting a piece of outreach on behalf of an independent operator to a lead their Lead Scout just found. Your job is to write an email that sounds like THEM — not like a polished PR person, not like ChatGPT, not like a mass cold-email template. Like them, writing to one specific business they want to win.
${avatarLine}

${memorySection}LEAD SCOUT SOURCE: "${ctx.sourceName}"

THE LEAD YOU'RE WRITING TO:
- Name: ${ctx.leadName || "(unknown)"}
- What they do: ${ctx.leadSummary || "(unclear from the scrape)"}
- Link: ${ctx.leadUrl || "(none)"}
${profileLines ? `Profile:\n${profileLines}` : "Profile: (sparse)"}

TONE FOR THIS DRAFT:
${TONE_DIRECTION[ctx.tone]}
${
  ctx.voiceBrief
    ? `\nVERTICAL BRIEF (this lead's trade — let it shape the angle and the one ask, but never override the operator's own voice from the brain above):\n${ctx.voiceBrief}\n`
    : ""
}
VOICE RULES (apply these strictly):
- Read the brain's voice or communication style notes carefully. Write in that voice exactly.
- If no voice spec is in the brain, default to: short sentences, direct, specific, no padding. The kind of email a busy operator sends between jobs — not a carefully polished business letter.
- No "I hope this finds you well." No "circling back." No "just checking in." No "at your earliest convenience."
- Open with the business name or a single-line greeting that fits a first contact. Not "Hi [Name]," — "Name —" or just the name.
- Frame the reason for the email in the first sentence. Don't build up to it.
- Specific > vague. Use the real, true details from the profile above. Never invent facts about the lead — if the profile doesn't say it, don't claim it.
- Close with a single-action CTA. One thing. Not three options.
- Sign off as the operator does (check the brain for their sign-off pattern; default to "— [FirstName]" if not found).
- Every factual claim pulled from the operator's memory must be cited: [memory/filename.md:line]. Claims about the LEAD come from the profile above and are not cited.

OUTPUT FORMAT (exactly this — nothing else):
Line 1: "Subject: " followed by a short, specific subject line (no quotes, under ~60 chars).
Line 2: blank.
Line 3 onward: the email body, starting with the greeting line. No preamble, no "here's the draft."`;
}

export function splitSubjectBody(raw: string): { subject: string; body: string } {
  const text = raw.trim();
  const match = text.match(/^subject:\s*(.+?)\s*(?:\n|$)/i);
  if (!match) {
    // Model didn't emit a subject line — fall back to a derived one so the draft still stages.
    return { subject: "", body: text };
  }
  const subject = match[1].trim();
  const body = text.slice(match[0].length).replace(/^\s+/, "");
  return { subject, body };
}

export async function generateOutreachDraft(
  ctx: LeadOutreachContext,
  anthropicApiKey: string,
  brainRepo: string | null,
  githubToken: string | null,
): Promise<{ subject: string; body: string; citations: Citation[]; hasBrain: boolean }> {
  const memoryBlocks: MemoryBlock[] = brainRepo
    ? await buildMemoryBlocks(brainRepo, githubToken)
    : [];

  const systemPrompt = buildOutreachSystemPrompt(memoryBlocks, ctx);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Write the outreach now. Start with the Subject line, then a blank line, then the email body.",
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic error: ${await res.text()}`);
  }

  const msg = (await res.json()) as AnthropicApiResponse;
  const draft = msg.content.find((c) => c.type === "text")?.text ?? "";
  const { subject, body } = splitSubjectBody(draft);
  return { subject, body, citations: parseCitations(body), hasBrain: memoryBlocks.length > 0 };
}

// ─── Weekly Digest ─────────────────────────────────────────────────────────────

export type DigestSection = {
  heading: string;
  items: string[];
};

export type DigestPayload = {
  learned: DigestSection;
  pending: DigestSection;
  suggestions: DigestSection;
  generatedAt: string;
  hasBrain: boolean;
  fileCount: number;
};

function buildDigestSystemPrompt(memoryBlocks: MemoryBlock[], today: string): string {
  const hasMemory = memoryBlocks.length > 0;
  const memorySection = hasMemory
    ? `BRAIN MEMORY FILES (the operator's knowledge base — everything the agent knows):\n${formatBlocks(memoryBlocks)}\n\n`
    : `NOTE: This operator's brain is empty — no memory files are connected yet.\n\n`;

  return `You are writing a "weekly read" for an independent business operator. This is a digest of what your AI agent currently knows about their business, what it's waiting on from them, and a couple of suggestions for what to add next.

Today's date: ${today}

${memorySection}YOUR TASK:
Write three short sections. Each section should have 2-5 bullet items. Be specific — use real names, projects, and context from the memory files. Do not pad. Do not invent things not in the memory.

SECTION 1: "What your agent knows"
List the most useful pieces of context the agent has learned. Frame each item as a concrete capability: "Knows you serve [X]", "Has your pricing for [Y]", "Understands your process for [Z]". If the brain is empty, say so honestly.

SECTION 2: "What needs your attention"
List anything in the memory that is flagged as pending, open, unresolved, or waiting for a decision. Include leads that haven't converted, open proposals, projects that are stalled, or questions that need answering. If nothing is pending, say "Nothing flagged as pending right now." as a single item.

SECTION 3: "Worth adding next"
Based on what's thin or missing from the brain, suggest 2-3 specific things the operator could add to make the agent more useful. Be concrete: "Add your standard pricing for roofing jobs", not "Add more context". If the brain is already well-filled, suggest refinements.

FORMATTING RULES:
- Each section title exactly as given above.
- Bullet items only — no prose paragraphs.
- Each bullet: one concise sentence. Under 20 words.
- No preamble. Start directly with the first section title.
- Prefix each section title with a line: "### " followed by the title.`;
}

type AnthropicDigestResponse = { content: Array<{ type: string; text: string }> };

function parseDigestSections(raw: string): Pick<DigestPayload, "learned" | "pending" | "suggestions"> {
  const lines = raw.split("\n");
  const sections: DigestSection[] = [];
  let current: DigestSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("### ")) {
      if (current) sections.push(current);
      current = { heading: trimmed.slice(4), items: [] };
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (current) current.items.push(trimmed.slice(2).trim());
    } else if (/^\d+\.\s/.test(trimmed) && current) {
      current.items.push(trimmed.replace(/^\d+\.\s/, "").trim());
    }
  }
  if (current) sections.push(current);

  const learned = sections[0] ?? { heading: "What your agent knows", items: ["Nothing in the brain yet."] };
  const pending = sections[1] ?? { heading: "What needs your attention", items: ["Nothing flagged as pending right now."] };
  const suggestions = sections[2] ?? { heading: "Worth adding next", items: ["Add context about your business to get started."] };

  return { learned, pending, suggestions };
}

export async function generateWeeklyDigest(
  anthropicApiKey: string,
  brainRepo: string | null,
  githubToken: string | null,
): Promise<DigestPayload> {
  const memoryBlocks: MemoryBlock[] = brainRepo
    ? await buildMemoryBlocks(brainRepo, githubToken)
    : [];

  const fileCount = brainRepo
    ? (await listMemoryFiles(brainRepo, githubToken)).length
    : 0;

  const today = new Date().toISOString().slice(0, 10);
  const system = buildDigestSystemPrompt(memoryBlocks, today);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system,
      messages: [
        {
          role: "user",
          content: "Generate my weekly read now. Start directly with the first section heading.",
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic error: ${await res.text()}`);
  }

  const msg = (await res.json()) as AnthropicDigestResponse;
  const raw = msg.content.find((c) => c.type === "text")?.text ?? "";
  const sections = parseDigestSections(raw);

  return {
    ...sections,
    generatedAt: new Date().toISOString(),
    hasBrain: memoryBlocks.length > 0,
    fileCount,
  };
}
