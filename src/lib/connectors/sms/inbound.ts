// connectors/sms/inbound.ts — pure parsing of a Twilio inbound webhook payload + small helpers the
// inbound route uses to turn a text (and any attachments) into a Pocket Agent chat turn. Kept free
// of network/DB so the parsing is unit-testable; the route owns the side effects.

// An MMS attachment as Twilio describes it on the inbound POST.
export type InboundMedia = { url: string; contentType: string };

export type ParsedInboundSms = {
  // The sender's number (the owner's customer) — where the reply goes.
  from: string;
  // The PA number that was texted — used to look up the owner.
  to: string;
  // The text body (may be empty for a media-only MMS).
  body: string;
  // Twilio's unique id for this message (idempotency key for retried webhooks).
  messageSid: string;
  media: InboundMedia[];
};

/**
 * Parse a Twilio inbound SMS/MMS form payload. Reads NumMedia and pulls MediaUrl{i} +
 * MediaContentType{i} for each attachment. Returns null when the payload is missing the fields
 * that make it a routable message (From / To / MessageSid).
 */
export function parseInboundSms(params: Record<string, string>): ParsedInboundSms | null {
  const from = params.From?.trim();
  const to = params.To?.trim();
  const messageSid = params.MessageSid?.trim() || params.SmsMessageSid?.trim();
  if (!from || !to || !messageSid) return null;

  const numMedia = Number.parseInt(params.NumMedia ?? "0", 10);
  const media: InboundMedia[] = [];
  if (Number.isFinite(numMedia) && numMedia > 0) {
    for (let i = 0; i < numMedia; i++) {
      const url = params[`MediaUrl${i}`]?.trim();
      const contentType = params[`MediaContentType${i}`]?.trim();
      if (url && contentType) media.push({ url, contentType });
    }
  }

  return { from, to, body: (params.Body ?? "").trim(), messageSid, media };
}

/** True when an MMS attachment is audio (a voice memo → Whisper). */
export function isAudioMedia(contentType: string): boolean {
  return contentType.toLowerCase().startsWith("audio/");
}

/**
 * Build the message body that gets persisted + read by the agent. Folds in a transcript (from a
 * voice memo) and any image-OCR context so the agent literally "reads" what was texted, and so the
 * conversation view shows what the owner sent rather than an empty media row.
 */
export function composeInboundContent(args: {
  body: string;
  transcript: string | null;
  imageContext: string | null;
}): string {
  const parts: string[] = [];
  if (args.body) parts.push(args.body);
  if (args.transcript) parts.push(`[Voice memo transcript]\n${args.transcript}`);
  if (args.imageContext) parts.push(args.imageContext);
  if (parts.length === 0) return "[Empty text message]";
  return parts.join("\n\n");
}
