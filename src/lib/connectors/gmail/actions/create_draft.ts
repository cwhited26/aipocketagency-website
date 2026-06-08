// connector.gmail.create_draft — stage an email in the owner's Gmail Drafts folder.
//
// Distinct from connector.gmail.send: drafts.create NEVER delivers. The draft sits in
// the owner's Drafts until they send it manually from Gmail, so this carries no
// real-world side effect — it runs inline in the chat tool loop with no Approval Inbox
// gate (the owner can delete the draft from Gmail like any other). Requires gmail.modify
// or gmail.compose (already in the base Connections scope set), NOT the incremental
// gmail.send scope — so it works for accounts connected before send existed.
//
// The input schema + MIME builder are reused verbatim from the send action so a draft
// and a send produce byte-identical RFC 2822 bodies; only the API endpoint differs.

import { createGmailDraft, type GmailDraftResponse, type GmailResult } from "@/lib/gmail";
import { buildMimeMessage, GmailSendInputSchema, type GmailSendInput } from "./send";

// A draft takes exactly the same fields as a send (recipients, subject, body, optional
// threading) — reuse the validated schema + type rather than forking a near-duplicate.
export const GmailDraftInputSchema = GmailSendInputSchema;
export type GmailDraftInput = GmailSendInput;

export type GmailDraftResult =
  | { ok: true; draftId: string; to: string[]; subject: string }
  | { ok: false; status: number; error: string; authError: boolean };

/**
 * Validate-free execute (caller validates with GmailDraftInputSchema): build the MIME
 * message and POST it to users.drafts.create. The caller supplies a fresh access token
 * (ensureFreshAccessToken) and the connected account's address for the From header.
 */
export async function execute(args: {
  accessToken: string;
  fromEmail: string | null;
  input: GmailDraftInput;
}): Promise<GmailDraftResult> {
  const recipients = args.input.to.map((r) => r.trim()).filter(Boolean);
  if (recipients.length === 0) {
    return {
      ok: false,
      status: 422,
      error: "Cannot create a draft — no recipient. Tell me who the email is to.",
      authError: false,
    };
  }

  const normalized: GmailDraftInput = { ...args.input, to: recipients };
  const raw = buildMimeMessage(normalized, args.fromEmail);

  const created: GmailResult<GmailDraftResponse> = await createGmailDraft(args.accessToken, {
    raw,
    threadId: normalized.thread_id ?? null,
  });
  if (!created.ok) return created;

  return { ok: true, draftId: created.data.id, to: recipients, subject: normalized.subject };
}

// ─── Action descriptor (SPEC §9.5 shape, parity with gmailSendAction) ──────────────

export const gmailCreateDraftAction = {
  name: "gmail.create_draft",
  description:
    "Create a draft in the owner's Gmail Drafts folder. Different from send — the email " +
    "stays a draft until the owner sends it manually from Gmail. No approval needed: a " +
    "draft has no real-world side effect, so it runs inline the moment the agent calls it.",
  inputSchema: GmailDraftInputSchema,
  execute,
} as const;
