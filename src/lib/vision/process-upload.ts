// process-upload.ts — turns the files dropped into the Ask box into (a) the plain-text context
// the agent reads and (b) the upload_result card the owner sees. For each file it runs the
// canonical capture pipeline (persist bytes to assets/ via lib/brain/absorb.ts) and then Claude
// vision OCR, logging every OCR attempt to pa_vision_log. Pure orchestration — the route stays
// thin and this stays the one place upload handling lives.

import { persistAssetBytes } from "@/lib/brain/absorb";
import {
  runVisionOcr,
  canOcrType,
  visionTypeLabel,
  estimateOcrCostUsd,
  buildOcrContextBlock,
} from "@/lib/vision/ocr";
import { logVisionAttempt } from "@/lib/vision/log";
import type { UploadCardFile } from "@/lib/chat/upload-card";

export type ProcessedUpload = {
  /** Plain-text block (one section per file) folded into the user's turn so the agent sees it. */
  modelContext: string;
  /** Card files for pocket_agent_messages.metadata → the upload_result render. */
  cardFiles: UploadCardFile[];
};

export type UploadInput = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

/**
 * Stores + OCRs each uploaded file. Every file always yields a card entry (even when persistence
 * or OCR fails — the owner still sees that the file was attached), and the agent-visible context
 * always names the file. Never throws; degraded paths carry an honest note.
 */
export async function processChatUploads(params: {
  userId: string;
  repo: string;
  token: string;
  anthropicApiKey: string;
  files: UploadInput[];
}): Promise<ProcessedUpload> {
  const cardFiles: UploadCardFile[] = [];
  const contextBlocks: string[] = [];

  for (const file of params.files) {
    const base64 = file.buffer.toString("base64");

    // 1. Persist the raw bytes to assets/<file> (canonical capture pipeline) → stable path/URL.
    const stored = await persistAssetBytes({
      repo: params.repo,
      token: params.token,
      fileName: file.fileName,
      base64,
      commitMessage: `Pocket Agent — store ${file.fileName} from chat`,
    });
    const assetPath = stored.ok ? stored.assetPath : "";

    // 2. HEIC/HEIF can't be read by vision — store only, agent gets a name-only mention.
    if (!canOcrType(file.mimeType)) {
      cardFiles.push({
        fileName: file.fileName,
        mimeType: file.mimeType,
        assetPath,
        ocrOk: false,
        extractedText: "",
        structuredDescription: "",
        confidence: 0,
        note: `${visionTypeLabel(file.mimeType)} saved — its text can't be read automatically.`,
      });
      contextBlocks.push(buildOcrContextBlock(file.fileName, null));
      continue;
    }

    // 3. Read it with Claude vision; log the attempt (success or failure) to pa_vision_log.
    const ocr = await runVisionOcr({
      apiKey: params.anthropicApiKey,
      mimeType: file.mimeType,
      buffer: file.buffer,
    });

    if (ocr.ok) {
      const costUsd = estimateOcrCostUsd(ocr.promptTokens, ocr.completionTokens);
      await logVisionAttempt({
        userId: params.userId,
        fileUrl: assetPath || file.fileName,
        promptTokens: ocr.promptTokens,
        completionTokens: ocr.completionTokens,
        costUsd,
        ok: true,
      });
      cardFiles.push({
        fileName: file.fileName,
        mimeType: file.mimeType,
        assetPath,
        ocrOk: true,
        extractedText: ocr.text,
        structuredDescription: ocr.structured_description,
        confidence: ocr.confidence,
      });
      contextBlocks.push(
        buildOcrContextBlock(file.fileName, {
          text: ocr.text,
          structured_description: ocr.structured_description,
        }),
      );
    } else {
      // Graceful failure: the file is already stored; record the error in the structured log and
      // show the card without extracted text.
      await logVisionAttempt({
        userId: params.userId,
        fileUrl: assetPath || file.fileName,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        ok: false,
        error: ocr.error,
      });
      cardFiles.push({
        fileName: file.fileName,
        mimeType: file.mimeType,
        assetPath,
        ocrOk: false,
        extractedText: "",
        structuredDescription: "",
        confidence: 0,
        note: `Saved, but I couldn't read the text: ${ocr.error}`,
      });
      contextBlocks.push(buildOcrContextBlock(file.fileName, null));
    }
  }

  return { modelContext: contextBlocks.join("\n\n"), cardFiles };
}
