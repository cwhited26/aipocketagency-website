// POST /api/mobile/capture — the endpoint an iOS Shortcut posts a photo to.
//
// The owner builds a Shortcut on their iPhone (share-sheet / camera → this URL) that sends a
// multipart form with `file` (the image/PDF) and an optional `prompt`, authenticated with a
// `pa_live_` API key (Settings → API keys) in the Authorization: Bearer header. We:
//   1. validate the key (401 on missing/invalid/revoked; this also stamps last_used_at),
//   2. find-or-create the owner's "Mobile capture" conversation,
//   3. run the file through the canonical capture pipeline (persist bytes to assets/ + Claude
//      vision OCR) so the photo lands in Documents and the agent can read it,
//   4. append a user-turn message (OCR text + description + the owner's prompt),
//   5. run the agent against that turn,
//   6. return the agent's reply as text/plain so the Shortcut's "Show Result" displays it.
//
// Plain-text bodies throughout (not JSON) so the Shortcut shows the reply — or an error — verbatim.

import { validateApiKey } from "@/lib/api-keys/keys";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  listConversations,
  createConversation,
  getMessages,
  insertMessage,
  type Conversation,
} from "@/lib/pa-conversations";
import { loadZoneConfig } from "@/lib/brain/containment-guard";
import { processChatUploads } from "@/lib/vision/process-upload";
import { isVisionUploadType, visionTypeLabel } from "@/lib/vision/ocr";
import { MAX_UPLOAD_BYTES } from "@/lib/brain/absorb";
import { UPLOAD_RESULT_KIND, type UploadResultPayload } from "@/lib/chat/upload-card";
import { runAgentTurn, type AgentToolContext } from "@/lib/mobile/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOBILE_CONVERSATION_TITLE = "Mobile capture";

/** A bare text/plain response — what every path of this endpoint returns. */
function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** Returns the owner's "Mobile capture" thread, creating it on first capture. */
async function findOrCreateMobileConversation(
  userId: string,
): Promise<{ ok: true; conversation: Conversation } | { ok: false; error: string }> {
  const list = await listConversations(userId);
  if (!list.ok) return { ok: false, error: list.error };
  const existing = list.data.find((c) => c.title === MOBILE_CONVERSATION_TITLE);
  if (existing) return { ok: true, conversation: existing };

  const created = await createConversation(userId, MOBILE_CONVERSATION_TITLE);
  if (!created.ok) return { ok: false, error: created.error };
  return { ok: true, conversation: created.data };
}

export async function POST(req: Request): Promise<Response> {
  // 1. Authenticate the API key. validateApiKey rejects missing/malformed/invalid/revoked and
  //    fire-and-forget stamps last_used_at on the matched row.
  const auth = await validateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    return text(`Unauthorized: API key ${auth.reason}. Generate one in Settings → API keys.`, 401);
  }
  const userId = auth.key.user_id;

  // 2. Parse the multipart form (file + optional prompt).
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return text("Bad request: send multipart/form-data with a 'file' field.", 400);
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return text("Bad request: could not read the multipart form.", 400);
  }

  const fileEntry = form.get("file");
  if (!(fileEntry instanceof File)) {
    return text("Bad request: no 'file' provided.", 400);
  }
  if (!isVisionUploadType(fileEntry.type)) {
    return text(
      `Unsupported file type: ${fileEntry.type || fileEntry.name}. Send a PNG, JPG, WebP, HEIC, GIF, or PDF.`,
      400,
    );
  }
  if (fileEntry.size > MAX_UPLOAD_BYTES) {
    return text(
      `File too large (${(fileEntry.size / 1_048_576).toFixed(1)} MB). Maximum is 10 MB.`,
      413,
    );
  }
  const prompt = (form.get("prompt") ?? "").toString().trim();

  // 3. Resolve the owner's brain context. The capture pipeline + agent both need the Anthropic
  //    key and a connected brain (to land the bytes in assets/ and read the brain).
  const paResult = await fetchPaUser(userId);
  if (!paResult.ok || !paResult.data) {
    return text("Could not load your account. Try again shortly.", 500);
  }
  const paUser = paResult.data;
  if (!paUser.anthropic_api_key) {
    return text("Add your Anthropic API key in Settings before using mobile capture.", 500);
  }
  if (!paUser.brain_repo || !paUser.github_token) {
    return text("Connect your brain in Settings before using mobile capture.", 500);
  }
  const { brain_repo, github_token, anthropic_api_key } = paUser;

  // 4. Find-or-create the Mobile capture thread.
  const convResult = await findOrCreateMobileConversation(userId);
  if (!convResult.ok) {
    return text(`Could not open your Mobile capture thread: ${convResult.error}`, 500);
  }
  const conversation = convResult.conversation;

  // 5. Run the file through the canonical capture pipeline: persist to assets/ + Claude vision
  //    OCR (logged to pa_vision_log). The extracted text + description fold into the user turn.
  const buffer = Buffer.from(await fileEntry.arrayBuffer());
  const fileName = fileEntry.name || `capture.${visionTypeLabel(fileEntry.type)}`;
  const processed = await processChatUploads({
    userId,
    repo: brain_repo,
    token: github_token,
    anthropicApiKey: anthropic_api_key,
    files: [{ fileName, mimeType: fileEntry.type, buffer }],
  });
  const effectiveContent = [prompt, processed.modelContext].filter(Boolean).join("\n\n");
  const uploadMetadata: UploadResultPayload = {
    kind: UPLOAD_RESULT_KIND,
    caption: prompt,
    files: processed.cardFiles,
  };

  // 6. Persist the user turn (with the upload card so the web thread renders it too).
  const priorResult = await getMessages(conversation.id, userId);
  const priorTurns = priorResult.ok
    ? priorResult.data.slice(-20).map((m) => ({ role: m.role, content: m.content }))
    : [];

  const userMsg = await insertMessage({
    conversationId: conversation.id,
    userId,
    role: "user",
    content: effectiveContent,
    metadata: uploadMetadata,
  });
  if (!userMsg.ok) {
    return text(`Could not save your capture: ${userMsg.error}`, 500);
  }

  // 7. Run the agent turn.
  const { config: zoneConfig } = await loadZoneConfig(brain_repo, github_token);
  const ctx: AgentToolContext = {
    userId,
    brain_repo,
    github_token,
    anthropic_api_key,
    zoneConfig,
  };
  const run = await runAgentTurn({ userContent: effectiveContent, priorTurns, ctx });
  if (!run.ok) {
    return text(`The agent hit an error: ${run.error}`, 500);
  }

  // 8. Persist the assistant turn, then return the reply as plain text to the Shortcut.
  //    The owner already has their answer and the capture (user turn) is saved; if persisting
  //    the assistant bubble to the web thread fails, that's a cosmetic loss, not a reason to
  //    fail the capture — so we hand back the reply on either outcome. (Not a silent catch:
  //    insertMessage returns a typed result; proceeding regardless is a deliberate choice.)
  await insertMessage({
    conversationId: conversation.id,
    userId,
    role: "assistant",
    content: run.answer,
  });

  return text(run.answer, 200);
}
