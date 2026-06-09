// agent.ts — the @inbound ("act on this") reply generator. When an owner forwards an email
// to <owner>@inbound, PA reads it against the owner's brain and writes back a reply: what it
// understood, what it can do, and — when the forward is clearly asking for an email to be
// written — a ready-to-send draft. One grounded Claude call (brain memory in the system
// prompt); direct REST, no SDK.

import { buildMemoryBlocks, type MemoryBlock } from "@/lib/pa-brain";
import { logCostFromUsage, type CostContext } from "@/lib/cost/log";
import type { ParsedInboundEmail } from "./parse";

function formatBlocks(blocks: MemoryBlock[]): string {
  return blocks
    .map(({ path, content }) => {
      const numbered = content
        .split("\n")
        .map((l, i) => `${i + 1}: ${l}`)
        .join("\n");
      return `--- ${path} ---\n${numbered}`;
    })
    .join("\n\n");
}

function buildSystemPrompt(blocks: MemoryBlock[]): string {
  const hasMemory = blocks.length > 0;
  const memorySection = hasMemory
    ? `BRAIN MEMORY FILES (the owner's business context — services, pricing, voice, clients, decisions):\n${formatBlocks(
        blocks,
      )}\n\n`
    : `NOTE: No brain memory is connected yet. Work from the forwarded email alone, and close by noting that connecting a brain will let you act with the owner's full context.\n\n`;

  return `You are the owner's personal AI chief of staff. The owner forwarded you an email — that's their way of saying "here's something I want you to act on." You are replying to the owner, not to the original sender.

${memorySection}HOW TO RESPOND:
- Read the forwarded email carefully. Say in one or two lines what it is and what it's asking for.
- Then do the useful thing: if it needs a reply written, write that reply in the owner's voice as a clearly-marked block they can copy and send. If it needs a decision, lay out the options and your recommendation. If it's information, tell the owner what you filed and why it matters.
- Be specific. Use names, amounts, dates, and prior context from the brain. Cite anything you pulled from memory as [memory/filename.md:line].
- Write the way the owner would — direct, short sentences, no corporate filler. No "I hope this finds you well."
- This is an email reply the owner reads on their phone. Keep it tight. No preamble like "Here's my response:" — just start.`;
}

function buildUserContent(email: ParsedInboundEmail): string {
  const attachmentNote =
    email.attachments.length > 0
      ? `\n\nAttachments (saved to the owner's Documents): ${email.attachments
          .map((a) => a.filename)
          .join(", ")}`
      : "";
  const body = email.text.trim() || email.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return `The owner forwarded this email:

From: ${email.fromRaw || email.fromAddr}
Subject: ${email.subject || "(no subject)"}

${body}${attachmentNote}`;
}

type AnthropicTextBlock = { type: "text"; text: string };
type AnthropicApiResponse = {
  content: AnthropicTextBlock[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

export type InboundReplyResult =
  | { ok: true; reply: string; hasBrain: boolean }
  | { ok: false; status: number; error: string };

/** Generate PA's reply to a forwarded email. Returns a typed failure rather than throwing. */
export async function generateInboundReply(params: {
  anthropicApiKey: string;
  brainRepo: string | null;
  githubToken: string | null;
  email: ParsedInboundEmail;
  /** When set, one anthropic cost event is logged for this reply generation. */
  cost?: CostContext;
}): Promise<InboundReplyResult> {
  const blocks: MemoryBlock[] = params.brainRepo
    ? await buildMemoryBlocks(params.brainRepo, params.githubToken)
    : [];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": params.anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: buildSystemPrompt(blocks),
      messages: [{ role: "user", content: buildUserContent(params.email) }],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    return { ok: false, status: 502, error: `Anthropic error: ${(await res.text()).slice(0, 200)}` };
  }
  const data = (await res.json()) as AnthropicApiResponse;
  if (params.cost) {
    await logCostFromUsage(params.cost, "anthropic", "claude-sonnet-4-6", {
      tokensInput: data.usage?.input_tokens ?? 0,
      tokensOutput: data.usage?.output_tokens ?? 0,
    });
  }
  const reply = data.content.find((c) => c.type === "text")?.text ?? "";
  if (!reply.trim()) return { ok: false, status: 502, error: "Empty reply from the model." };
  return { ok: true, reply, hasBrain: blocks.length > 0 };
}
