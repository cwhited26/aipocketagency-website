import { describe, it, expect } from "vitest";
import {
  isVisionUploadType,
  canOcrType,
  visionTypeLabel,
  estimateOcrCostUsd,
  buildOcrContent,
  buildOcrContextBlock,
  VISION_MODEL,
} from "../ocr";
import { UploadResultPayloadSchema, asUploadResultPayload } from "@/lib/chat/upload-card";

describe("vision type gating", () => {
  it("accepts the Ask box upload set", () => {
    for (const t of [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/heic",
      "image/heif",
      "application/pdf",
    ]) {
      expect(isVisionUploadType(t)).toBe(true);
    }
  });

  it("rejects unsupported types", () => {
    expect(isVisionUploadType("text/plain")).toBe(false);
    expect(isVisionUploadType("application/zip")).toBe(false);
  });

  it("OCRs images + PDF but not HEIC", () => {
    expect(canOcrType("image/png")).toBe(true);
    expect(canOcrType("image/gif")).toBe(true);
    expect(canOcrType("application/pdf")).toBe(true);
    expect(canOcrType("image/heic")).toBe(false);
    expect(canOcrType("image/heif")).toBe(false);
  });

  it("labels known types and falls back", () => {
    expect(visionTypeLabel("image/png")).toBe("PNG image");
    expect(visionTypeLabel("application/octet-stream")).toBe("application/octet-stream");
  });
});

describe("buildOcrContent", () => {
  it("uses a document block for PDFs", () => {
    const blocks = buildOcrContent("application/pdf", "ZmFrZQ==");
    expect(blocks?.[0]).toMatchObject({ type: "document" });
  });

  it("uses an image block for images", () => {
    const blocks = buildOcrContent("image/webp", "ZmFrZQ==");
    expect(blocks?.[0]).toMatchObject({ type: "image", source: { media_type: "image/webp" } });
  });

  it("returns null for unreadable types", () => {
    expect(buildOcrContent("image/heic", "ZmFrZQ==")).toBeNull();
  });
});

describe("estimateOcrCostUsd", () => {
  it("prices Sonnet at $3/MTok in + $15/MTok out, rounded to 4dp", () => {
    // 1000 in + 500 out → 0.003 + 0.0075 = 0.0105
    expect(estimateOcrCostUsd(1000, 500)).toBeCloseTo(0.0105, 6);
    expect(estimateOcrCostUsd(0, 0)).toBe(0);
  });
});

describe("buildOcrContextBlock", () => {
  it("names the file and includes extracted text + description", () => {
    const block = buildOcrContextBlock("post.png", {
      text: "Row1\tRow2",
      structured_description: "a spreadsheet screenshot",
    });
    expect(block).toContain("post.png");
    expect(block).toContain("a spreadsheet screenshot");
    expect(block).toContain("Row1\tRow2");
  });

  it("degrades to a name-only mention when OCR is unavailable", () => {
    const block = buildOcrContextBlock("photo.heic", null);
    expect(block).toContain("photo.heic");
    expect(block).toContain("could not be read");
  });
});

describe("upload_result card payload", () => {
  it("round-trips a valid payload and pins the model string", () => {
    const payload = {
      kind: "upload_result" as const,
      caption: "what does this say?",
      files: [
        {
          fileName: "post.png",
          mimeType: "image/png",
          assetPath: "assets/post.png",
          ocrOk: true,
          extractedText: "hello",
          structuredDescription: "a screenshot",
          confidence: 0.9,
        },
      ],
    };
    expect(UploadResultPayloadSchema.parse(payload)).toEqual(payload);
    expect(asUploadResultPayload(payload)).not.toBeNull();
    expect(asUploadResultPayload({ kind: "nope" })).toBeNull();
    expect(VISION_MODEL).toBe("claude-sonnet-4-6");
  });
});
