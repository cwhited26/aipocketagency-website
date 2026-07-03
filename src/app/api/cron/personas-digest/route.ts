import { NextResponse } from "next/server";
import {
  fetchOwnerEmail,
  listAllActivePersonas,
  listConversationsSince,
  listMessages,
} from "@/lib/personas/db";
import { fetchPaUser } from "@/lib/pa-supabase";
import { commitMemoryFile } from "@/lib/pa-brain";
import { sendEmail } from "@/lib/resend";
import { getPersonaDisplayName, type PersonaMessageRow, type PersonaRow } from "@/lib/personas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FROM = "Chase Whited <chase@aipocketagent.com>";
const REPLY_TO = "chase@aipocketagent.com";
const WINDOW_DAYS = 7;

type DigestResult = {
  personaId: string;
  status: "sent" | "skipped" | "error";
  reason?: string;
};

// Friday weekly digest. Vercel crons run in UTC; true per-owner local-time delivery is
// a Wave 1 limitation (no owner timezone stored) — scheduled ~9am US-eastern via
// vercel.json. The job summarizes each active persona's last 7 days and emails the owner.
export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

  let personas: PersonaRow[];
  try {
    personas = await listAllActivePersonas();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list personas" },
      { status: 500 },
    );
  }

  const results: DigestResult[] = [];
  for (const persona of personas) {
    try {
      results.push(await digestForPersona(persona, since));
    } catch (e) {
      results.push({
        personaId: persona.id,
        status: "error",
        reason: e instanceof Error ? e.message : "unexpected error",
      });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  return NextResponse.json({ processed: results.length, sent, results });
}

async function digestForPersona(persona: PersonaRow, sinceIso: string): Promise<DigestResult> {
  const conversations = await listConversationsSince(persona.id, sinceIso);
  if (conversations.length === 0) {
    return { personaId: persona.id, status: "skipped", reason: "no activity" };
  }

  const allMessages: PersonaMessageRow[] = [];
  for (const c of conversations) {
    const msgs = await listMessages(c.id);
    allMessages.push(...msgs);
  }
  const blockedCount = allMessages.filter((m) => m.blocked_by_containment).length;

  const ownerRes = await fetchPaUser(persona.business_id);
  const apiKey = ownerRes.ok ? ownerRes.data?.anthropic_api_key ?? null : null;
  const brainRepo = ownerRes.ok ? ownerRes.data?.brain_repo ?? null : null;
  const githubToken = ownerRes.ok ? ownerRes.data?.github_token ?? null : null;

  const personaName = getPersonaDisplayName(persona);
  const summary = apiKey
    ? await summarize(apiKey, personaName, allMessages, blockedCount)
    : fallbackSummary(conversations.length, allMessages.length, blockedCount);

  // Log the digest to the owner's brain (inbox/digests/personas/...).
  if (brainRepo && githubToken) {
    const date = new Date().toISOString().slice(0, 10);
    await commitMemoryFile({
      repo: brainRepo,
      token: githubToken,
      path: `inbox/digests/personas/${date}-${persona.slug}.md`,
      mode: "replace",
      content: `# ${personaName} — weekly digest (${date})\n\n${summary}\n`,
      commitMessage: `persona digest: ${persona.slug} ${date}`,
    });
  }

  const email = await fetchOwnerEmail(persona.business_id);
  if (!email) return { personaId: persona.id, status: "skipped", reason: "no owner email" };

  const send = await sendEmail({
    from: FROM,
    to: email,
    replyTo: REPLY_TO,
    subject: `Weekly digest — ${personaName}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px"><h2>${escapeHtml(personaName)} — this week</h2><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(summary)}</pre><p style="color:#94a3b8;font-size:12px">Pocket Agent · ${conversations.length} conversations this week</p></div>`,
    text: `${personaName} — this week\n\n${summary}\n\n${conversations.length} conversations this week.`,
  });
  if (!send.ok) return { personaId: persona.id, status: "error", reason: send.error };
  return { personaId: persona.id, status: "sent" };
}

function fallbackSummary(convos: number, messages: number, blocked: number): string {
  return [
    `Activity: ${convos} conversations, ${messages} messages.`,
    `Out-of-zone read attempts: ${blocked} (should be 0).`,
    "Add your Anthropic API key in Settings to get themed summaries with top topics and stuck reps.",
  ].join("\n");
}

type Anthropic = { content: Array<{ type: string; text?: string }> };

async function summarize(
  apiKey: string,
  personaName: string,
  messages: PersonaMessageRow[],
  blockedCount: number,
): Promise<string> {
  const transcript = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")
    .slice(0, 60_000);

  const system = `You are writing a concise weekly coaching digest for a business owner about how their team used the AI persona "${personaName}". Output plain text with these sections, each 1-3 bullets:
TOP 3 THEMES — what the team kept asking about.
TOP 3 STUCK SEATS/PEOPLE — recurring confusion or unresolved questions (describe the pattern, no need for names if unknown).
TOP 3 OBJECTIONS / FRICTION — where answers fell short or people pushed back.
OUT-OF-ZONE ATTEMPTS — report this number: ${blockedCount} (flag if non-zero).
Keep it tight and useful. No preamble.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.PA_PERSONAS_DEFAULT_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: transcript || "No messages." }],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    return fallbackSummary(0, messages.length, blockedCount);
  }
  const data = (await res.json()) as Anthropic;
  return data.content.find((c) => c.type === "text")?.text ?? fallbackSummary(0, messages.length, blockedCount);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
