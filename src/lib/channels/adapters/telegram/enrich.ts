// lib/channels/adapters/telegram/enrich.ts — turn a classified voice/document inbound into the text
// body the gateway dispatches (PA-CHAN-1, Channels Gateway Phase 2).
//
// This is the async half of the inbound read (the structural half is types.ts). It needs the bot
// token to download the attachment, so it can't live in the pure classifier. Two paths:
//   • voice/audio → download the file, run it through Whisper (lib/voice/transcribe — the same
//     transcription path the in-app voice memo + SMS-MMS surfaces use), prepend any caption.
//   • document   → download the file, extract text (documents.ts: PDF / CSV / code / text).
// A failure on either degrades to a short, honest note ("I got your voice note but couldn't make out
// the audio…") so the inbound turn still answers rather than going silent.

import {
  telegramGetFile,
  telegramDownloadFile,
  type TelegramResult,
} from "./api";
import { transcribeAudio, WHISPER_MAX_BYTES } from "@/lib/voice/transcribe";
import { parseDocument, MAX_DOCUMENT_BYTES } from "./documents";
import type { TelegramFileRef } from "./types";
import { channelLog } from "@/lib/channels/log";

export type EnrichResult =
  | { ok: true; body: string }
  // A soft failure: still reply, but with this note instead of an agent answer.
  | { ok: false; note: string };

async function downloadRef(
  botToken: string,
  file: TelegramFileRef,
  maxBytes: number,
): Promise<TelegramResult<Buffer>> {
  if (file.fileSize !== null && file.fileSize > maxBytes) {
    return { ok: false, status: 413, error: "file_too_large", authError: false };
  }
  const resolved = await telegramGetFile(botToken, file.fileId);
  if (!resolved.ok) return resolved;
  if (!resolved.data.file_path) {
    return { ok: false, status: 502, error: "no_file_path", authError: false };
  }
  return telegramDownloadFile(botToken, resolved.data.file_path);
}

/** Download + transcribe a voice note. The caption (if any) rides ahead of the transcript. */
export async function enrichVoice(args: {
  botToken: string;
  caption: string;
  file: TelegramFileRef;
}): Promise<EnrichResult> {
  const { botToken, caption, file } = args;
  const dl = await downloadRef(botToken, file, WHISPER_MAX_BYTES);
  if (!dl.ok) {
    channelLog.warn("telegram voice download failed", { reason: dl.error });
    return {
      ok: false,
      note:
        dl.error === "file_too_large"
          ? "That voice note is too long for me to transcribe (25 MB max). Send a shorter one and I'll pick it up."
          : "I got your voice note but couldn't download the audio. Mind sending it again?",
    };
  }

  const fileName = file.fileName ?? "voice-note.oga";
  const transcript = await transcribeAudio({
    buffer: dl.data,
    fileName,
    mimeType: file.mimeType ?? "audio/ogg",
  });
  if (!transcript.ok) {
    channelLog.warn("telegram voice transcription failed", { status: transcript.status });
    return {
      ok: false,
      note: "I got your voice note but couldn't make out the audio. Try again, or type it to me.",
    };
  }

  const body = caption ? `${caption}\n\n${transcript.text}` : transcript.text;
  return { ok: true, body };
}

/** Download + extract text from a document. The caption frames the ask around the file's contents. */
export async function enrichDocument(args: {
  botToken: string;
  caption: string;
  file: TelegramFileRef;
}): Promise<EnrichResult> {
  const { botToken, caption, file } = args;
  const dl = await downloadRef(botToken, file, MAX_DOCUMENT_BYTES);
  if (!dl.ok) {
    channelLog.warn("telegram document download failed", { reason: dl.error });
    return {
      ok: false,
      note:
        dl.error === "file_too_large"
          ? "That file is bigger than I can read here (10 MB max). Send a smaller one?"
          : "I got your file but couldn't download it. Mind sending it again?",
    };
  }

  const parsed = await parseDocument({
    buffer: dl.data,
    fileName: file.fileName,
    mimeType: file.mimeType,
  });
  if (!parsed.ok) {
    const note =
      parsed.reason === "unsupported_type"
        ? `I can read PDFs, CSVs, and text/code files, but not ${file.fileName ?? "that file type"}. Paste the text and I'll take it from there.`
        : "I got your file but couldn't pull any text out of it. If it's a scan or an image, paste the text instead.";
    return { ok: false, note };
  }

  const label = file.fileName ? `Document "${file.fileName}"` : "Attached document";
  const truncatedNote = parsed.truncated ? " (truncated to the first part)" : "";
  const ask = caption || "Here's a document — take a look and tell me what stands out.";
  const body = `${ask}\n\n--- ${label}${truncatedNote} ---\n${parsed.text}`;
  return { ok: true, body };
}
