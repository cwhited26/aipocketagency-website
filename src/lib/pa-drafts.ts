import { buildMemoryBlocks, parseCitations } from "./pa-brain";
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

  return `You are a skilled quote and proposal writer for an independent operator.

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

  return `You are drafting an email on behalf of an independent operator. Your job is to write an email that sounds like THEM — not like a polished PR person, not like ChatGPT, not like a corporate account manager. Like them.

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

export async function generateEmailDraft(
  params: {
    recipient: string;
    relationship: string;
    purpose: string;
    keyPoints: string;
    tone: string;
  },
  anthropicApiKey: string,
  brainRepo: string | null,
  githubToken: string | null,
): Promise<{ draft: string; citations: Citation[]; hasBrain: boolean }> {
  const memoryBlocks: MemoryBlock[] = brainRepo
    ? await buildMemoryBlocks(brainRepo, githubToken)
    : [];

  const systemPrompt = buildEmailSystemPrompt(
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
