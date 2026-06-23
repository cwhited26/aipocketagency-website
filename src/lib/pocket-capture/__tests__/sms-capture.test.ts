import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the side-effecting dependencies so writeSmsCapture's media re-upload + brain write are
// observable without real network/Storage/GitHub.
vi.mock("@/lib/connectors/sms/media", () => ({
  fetchTwilioMedia: vi.fn(),
}));
vi.mock("@/lib/pocket-capture/storage", () => ({
  uploadCaptureAttachment: vi.fn(),
}));
vi.mock("@/lib/pa-brain", () => ({
  fetchFileContent: vi.fn(async () => ""),
  commitMemoryFile: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/pa-inbox", () => ({
  appendEntryToRaw: vi.fn((existing: string, entry: { content: string }) => ({
    content: `${existing}\n${entry.content}`,
  })),
}));

import {
  buildSmsCaptureContent,
  mediaFilename,
  isCarrierKeyword,
  writeSmsCapture,
} from "../sms-capture";
import { fetchTwilioMedia } from "@/lib/connectors/sms/media";
import { uploadCaptureAttachment } from "@/lib/pocket-capture/storage";
import { commitMemoryFile } from "@/lib/pa-brain";
import type { ParsedInboundSms } from "@/lib/connectors/sms/inbound";

const owner = { id: "owner-1", brain_repo: "user/brain", github_token: "ghtok" };

beforeEach(() => {
  process.env.PA_TWILIO_ACCOUNT_SID = "AC_test";
  process.env.PA_TWILIO_AUTH_TOKEN = "tok_test";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("isCarrierKeyword", () => {
  it.each(["STOP", "stop", " Help ", "UNSUBSCRIBE", "cancel"])("flags %j", (kw) => {
    expect(isCarrierKeyword(kw)).toBe(true);
  });
  it("does not flag a real capture that merely contains a keyword", () => {
    expect(isCarrierKeyword("stop by the store tomorrow")).toBe(false);
  });
  it("does not flag empty", () => expect(isCarrierKeyword("")).toBe(false));
});

describe("mediaFilename", () => {
  it("maps known content types to extensions", () => {
    expect(mediaFilename(0, "image/jpeg")).toBe("media-0.jpg");
    expect(mediaFilename(1, "audio/amr")).toBe("media-1.amr");
    expect(mediaFilename(2, "application/pdf")).toBe("media-2.pdf");
  });
  it("falls back to .bin for unknown types and tolerates a charset suffix", () => {
    expect(mediaFilename(0, "application/x-weird")).toBe("media-0.bin");
    expect(mediaFilename(3, "image/png; charset=binary")).toBe("media-3.png");
  });
});

describe("buildSmsCaptureContent", () => {
  it("combines sender + body", () => {
    const out = buildSmsCaptureContent({
      fromNumber: "+14158675310",
      body: "Run the webinar twice.",
      stored: [],
      attachmentErrors: [],
    });
    expect(out).toContain("From: +14158675310");
    expect(out).toContain("Run the webinar twice.");
    expect(out).not.toContain("Attachments:");
  });
  it("lists stored attachments and errors", () => {
    const out = buildSmsCaptureContent({
      fromNumber: "+1555",
      body: "",
      stored: [{ filename: "media-0.jpg", path: "pocket-capture/owner-1/SM1/media-0.jpg" }],
      attachmentErrors: ["media-1.bin — download failed: boom"],
    });
    expect(out).toContain("Attachments:");
    expect(out).toContain("- media-0.jpg — stored at pocket-capture/owner-1/SM1/media-0.jpg");
    expect(out).toContain("- media-1.bin — download failed: boom");
  });
  it("marks an empty media-less message", () => {
    const out = buildSmsCaptureContent({ fromNumber: "+1", body: "", stored: [], attachmentErrors: [] });
    expect(out).toContain("[Empty text message]");
  });
});

describe("writeSmsCapture — media re-upload", () => {
  const sms: ParsedInboundSms = {
    from: "+14158675310",
    to: "+18005551212",
    body: "photo of the whiteboard",
    messageSid: "SM_abc",
    media: [{ url: "https://api.twilio.com/media/0", contentType: "image/jpeg" }],
  };

  it("downloads each MMS media and re-uploads it to Storage, listing the object path", async () => {
    vi.mocked(fetchTwilioMedia).mockResolvedValue({
      ok: true,
      data: { buffer: Buffer.from("jpegbytes"), contentType: "image/jpeg" },
    });
    vi.mocked(uploadCaptureAttachment).mockResolvedValue({
      ok: true,
      path: "pocket-capture/owner-1/SM_abc/media-0.jpg",
    });

    const result = await writeSmsCapture({ owner, sms, captureId: "SM_abc" });
    expect(result.ok).toBe(true);

    // Downloaded from the Twilio media URL...
    expect(fetchTwilioMedia).toHaveBeenCalledWith(
      expect.anything(),
      "https://api.twilio.com/media/0",
      "image/jpeg",
    );
    // ...and re-uploaded under pocket-capture/<owner>/<sms_msg_sid>/<filename>.
    expect(uploadCaptureAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "owner-1", captureId: "SM_abc", filename: "media-0.jpg" }),
    );
    if (result.ok) expect(result.stored).toEqual([{ filename: "media-0.jpg", path: "pocket-capture/owner-1/SM_abc/media-0.jpg" }]);

    // The committed inbox entry references the stored object.
    const commitArg = vi.mocked(commitMemoryFile).mock.calls[0][0];
    expect(commitArg.content).toContain("pocket-capture/owner-1/SM_abc/media-0.jpg");
  });

  it("records a download failure in the body without throwing", async () => {
    vi.mocked(fetchTwilioMedia).mockResolvedValue({ ok: false, status: 502, error: "expired" });

    const result = await writeSmsCapture({ owner, sms, captureId: "SM_abc" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stored).toEqual([]);
      expect(result.attachmentErrors[0]).toContain("download failed");
    }
    expect(uploadCaptureAttachment).not.toHaveBeenCalled();
  });

  it("returns no-brain when the owner has no brain repo connected", async () => {
    const result = await writeSmsCapture({
      owner: { id: "o", brain_repo: null, github_token: null },
      sms,
      captureId: "SM_abc",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no-brain");
  });
});
