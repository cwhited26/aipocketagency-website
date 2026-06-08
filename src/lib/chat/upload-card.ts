// upload-card.ts — the contract for the inline "upload_result" card the Ask box renders when an
// owner drops images/PDFs into the chat. It rides in pocket_agent_messages.metadata (migration
// 034); the agent reads the OCR text from the message `content`, while this payload drives the
// rich render: thumbnails, the extracted text, and an honest "the agent can see this" footer.
//
// One Zod source of truth so a drifted metadata blob fails validation and degrades to a plain
// bubble instead of crashing the thread. Types are z.infer'd — zero `any`.

import { z } from "zod";

export const UPLOAD_RESULT_KIND = "upload_result" as const;

export const UploadCardFileSchema = z.object({
  fileName: z.string().min(1).max(500),
  mimeType: z.string().max(200),
  /** Repo-relative asset path (assets/<file>); the thumbnail route streams the bytes from it. */
  assetPath: z.string().max(500),
  /** True when Claude vision read the file; false → stored only (HEIC) or OCR failed. */
  ocrOk: z.boolean(),
  /** Verbatim text Claude pulled from the image (empty when none / OCR skipped). */
  extractedText: z.string().max(20_000),
  /** Plain-English description of what the image shows. */
  structuredDescription: z.string().max(2_000),
  /** Claude's 0-1 self-assessed extraction confidence (0 when OCR skipped/failed). */
  confidence: z.number().min(0).max(1),
  /** Reason text shown on the card when ocrOk is false. */
  note: z.string().max(500).optional(),
});
export type UploadCardFile = z.infer<typeof UploadCardFileSchema>;

export const UploadResultPayloadSchema = z.object({
  kind: z.literal(UPLOAD_RESULT_KIND),
  /** The text the owner typed alongside the upload (may be empty). */
  caption: z.string().max(10_000),
  files: z.array(UploadCardFileSchema).min(1).max(5),
});
export type UploadResultPayload = z.infer<typeof UploadResultPayloadSchema>;

/** Safe-parses message.metadata into an upload-card payload, or null if it isn't one. */
export function asUploadResultPayload(metadata: unknown): UploadResultPayload | null {
  const parsed = UploadResultPayloadSchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}
