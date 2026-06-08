// /api/connectors/sms/inbound — the Twilio webhook for an inbound SMS/MMS to a provisioned PA
// number. This is the phone-start surface: a text lands in the owner's PA chat thread, the agent
// reads it (transcribing voice memos, OCR-ing images), and its reply goes back out over SMS.
//
// Trust + flow:
//   1. Verify the X-Twilio-Signature header (forged POSTs can't inject into a thread).
//   2. Parse From/To/Body/NumMedia/MediaUrl*/MessageSid; look up the owner by the `To` number.
//   3. Enrich attachments — audio → Whisper transcript, image → Claude vision OCR — folded into
//      the message the agent reads.
//   4. Run the shared headless conversation turn (persists the inbound as an SMS-origin user
//      message, runs the brain agent, persists the reply) and text the reply back via the Twilio
//      Messages REST API (long replies split into segments).
//
// Once a signed, owner-bound message is accepted we always answer Twilio 200 (empty TwiML) — even
// if a downstream step fails we send a courtesy SMS instead of a 5xx, so Twilio doesn't retry and
// double-post the same text.

import { NextResponse } from "next/server";
import { twilioConfig, smsInboundUrl } from "@/lib/connectors/sms/config";
import { verifyTwilioSignature } from "@/lib/connectors/sms/signature";
import { parseInboundSms, isAudioMedia, composeInboundContent } from "@/lib/connectors/sms/inbound";
import { fetchTwilioMedia } from "@/lib/connectors/sms/media";
import { sendSms } from "@/lib/connectors/sms/send";
import { fetchSmsNumberByE164 } from "@/lib/pa-sms-numbers";
import { fetchPaUser } from "@/lib/pa-supabase";
import { findOrCreateSmsConversation } from "@/lib/pa-conversations";
import { runConversationTurn } from "@/lib/chat/conversation-agent";
import { smsOrigin } from "@/lib/chat/message-origin";
import {
  runVisionOcr,
  canOcrType,
  buildOcrContextBlock,
  estimateOcrCostUsd,
} from "@/lib/vision/ocr";
import { logVisionAttempt } from "@/lib/vision/log";
import { transcribeAudio } from "@/lib/voice/transcribe";
import { maybeIngestYouTubeUrls, buildYouTubeContextAppend } from "@/lib/youtube/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Empty TwiML — "received, nothing to say inline" (the reply is sent over the REST API instead).
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
function twiml(): NextResponse {
  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

// A voice-memo attachment can be slow; an image OCR even slower. Bound the OCR so the whole webhook
// finishes well inside Twilio's retry window.
const SMS_OCR_TIMEOUT_MS = 20_000;

export async function POST(req: Request): Promise<NextResponse> {
  const config = twilioConfig();
  if (!config) {
    return NextResponse.json({ error: "SMS connector not configured." }, { status: 503 });
  }

  // Twilio posts application/x-www-form-urlencoded. Read it into a flat record for both signature
  // verification and parsing.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected form-encoded Twilio payload." }, { status: 400 });
  }
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  // 1. Verify the signature against the URL we configured as the number's SmsUrl (not the request
  // host, which is spoofable). A failure is a forged or misconfigured request → 403.
  const valid = verifyTwilioSignature({
    authToken: config.authToken,
    url: smsInboundUrl(),
    params,
    signature: req.headers.get("x-twilio-signature"),
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 403 });
  }

  // 2. Parse + route. A payload that isn't a routable message, or a number with no owner binding,
  // is acknowledged (200) so Twilio stops — there's simply nothing to do.
  const parsed = parseInboundSms(params);
  if (!parsed) return twiml();

  const numberResult = await fetchSmsNumberByE164(parsed.to);
  if (!numberResult.ok || !numberResult.data) return twiml();
  const ownerId = numberResult.data.owner_id;

  const paResult = await fetchPaUser(ownerId);
  const paUser = paResult.ok ? paResult.data : null;

  // No owner record or no Anthropic key → the agent can't answer. Tell the sender over SMS and stop
  // (mirrors the inbound Slack lane, which simply doesn't run a turn without a key).
  if (!paUser?.anthropic_api_key) {
    await sendSms(config, {
      from: parsed.to,
      to: parsed.from,
      body: "Your Pocket Agent isn't set up to reply yet — add your Anthropic API key in Settings and text me again.",
    });
    return twiml();
  }

  // 3. Enrich attachments. Audio → Whisper transcript; image → Claude vision OCR. Each failure
  // degrades to an honest inline note rather than vanishing.
  let transcript: string | null = null;
  let imageContext: string | null = null;

  for (const media of parsed.media) {
    if (isAudioMedia(media.contentType)) {
      const fetched = await fetchTwilioMedia(config, media.url, media.contentType);
      if (!fetched.ok) {
        transcript = "(A voice memo came in but couldn't be downloaded.)";
        continue;
      }
      const result = await transcribeAudio({
        buffer: fetched.data.buffer,
        fileName: `voice-memo.${audioExtension(media.contentType)}`,
        mimeType: media.contentType,
      });
      transcript = result.ok
        ? result.text
        : `(A voice memo came in but couldn't be transcribed: ${result.error})`;
      continue;
    }

    if (canOcrType(media.contentType)) {
      const fetched = await fetchTwilioMedia(config, media.url, media.contentType);
      if (!fetched.ok) {
        imageContext = buildOcrContextBlock("texted image", null);
        continue;
      }
      const ocr = await runVisionOcr({
        apiKey: paUser.anthropic_api_key,
        mimeType: fetched.data.contentType,
        buffer: fetched.data.buffer,
        timeoutMs: SMS_OCR_TIMEOUT_MS,
      });
      // Log every attempt (success + failure) — no silent catch (mirrors the chat-upload path).
      await logVisionAttempt({
        userId: ownerId,
        fileUrl: media.url,
        promptTokens: ocr.ok ? ocr.promptTokens : 0,
        completionTokens: ocr.ok ? ocr.completionTokens : 0,
        costUsd: ocr.ok ? estimateOcrCostUsd(ocr.promptTokens, ocr.completionTokens) : 0,
        ok: ocr.ok,
        error: ocr.ok ? null : ocr.error,
      });
      imageContext = buildOcrContextBlock(
        "texted image",
        ocr.ok ? { text: ocr.text, structured_description: ocr.structured_description } : null,
      );
    }
  }

  const baseContent = composeInboundContent({ body: parsed.body, transcript, imageContext });

  // A YouTube link in the text → ingest it (transcript + metadata → brain note) and fold the
  // transcript into the turn so PA can act on the video and text back about it.
  const ytResults = await maybeIngestYouTubeUrls(parsed.body, ownerId, "sms");
  const content =
    ytResults.length > 0
      ? [baseContent, buildYouTubeContextAppend(ytResults)].join("\n\n")
      : baseContent;

  // 4. Resolve the owner's single SMS thread, then run the shared headless turn (persists the
  // inbound user message with the SMS origin chip, runs the agent, persists the reply).
  const convResult = await findOrCreateSmsConversation(ownerId);
  if (!convResult.ok) return twiml();

  const turn = await runConversationTurn({
    paUser,
    userId: ownerId,
    conversationId: convResult.data,
    content,
    userMetadata: smsOrigin(),
  });

  const replyBody = turn.ok
    ? turn.finalAnswer
    : "I hit a snag answering that just now — try me again in a moment.";

  await sendSms(config, { from: parsed.to, to: parsed.from, body: replyBody });

  return twiml();
}

// Map an audio MIME type to a file extension Whisper recognises from the filename.
function audioExtension(contentType: string): string {
  const subtype = contentType.toLowerCase().split("/")[1]?.split(";")[0] ?? "";
  if (subtype.includes("mpeg") || subtype.includes("mp3")) return "mp3";
  if (subtype.includes("mp4") || subtype.includes("m4a") || subtype.includes("aac")) return "m4a";
  if (subtype.includes("ogg") || subtype.includes("opus")) return "ogg";
  if (subtype.includes("wav")) return "wav";
  if (subtype.includes("amr")) return "amr";
  if (subtype.includes("webm")) return "webm";
  return "mp3";
}
