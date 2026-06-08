import { describe, it, expect } from "vitest";
import {
  extractYouTubeIds,
  containsYouTubeUrl,
  watchUrl,
  defaultThumbnailUrl,
} from "../detect";
import { parseTimedText } from "../transcript";
import { parseIsoDuration } from "../metadata";
import { brainNotePath } from "../ingest";
import { YouTubeIngestPayloadSchema, asYouTubeIngestPayload, YOUTUBE_INGEST_KIND } from "../card";

describe("youtube url detection", () => {
  it("recognizes every supported URL shape and returns the canonical 11-char id", () => {
    const cases: Array<[string, string]> = [
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
      ["http://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"],
      ["https://music.youtube.com/watch?list=RD&v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
      ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
      ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
      ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
      ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
      ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
      ["https://www.youtube.com/v/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ];
    for (const [url, id] of cases) {
      expect(extractYouTubeIds(url), url).toEqual([id]);
    }
  });

  it("pulls a link out of surrounding prose", () => {
    expect(
      extractYouTubeIds("check this out https://youtu.be/dQw4w9WgXcQ it's great"),
    ).toEqual(["dQw4w9WgXcQ"]);
  });

  it("dedupes the same video and preserves first-seen order across forms", () => {
    const text =
      "https://youtu.be/aaaaaaaaaaa then https://www.youtube.com/watch?v=bbbbbbbbbbb and https://youtu.be/aaaaaaaaaaa again";
    expect(extractYouTubeIds(text)).toEqual(["aaaaaaaaaaa", "bbbbbbbbbbb"]);
  });

  it("returns [] for non-YouTube text and empty input", () => {
    expect(extractYouTubeIds("https://vimeo.com/12345 no youtube here")).toEqual([]);
    expect(extractYouTubeIds("")).toEqual([]);
    expect(containsYouTubeUrl("just words")).toBe(false);
    expect(containsYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("does not truncate a longer token into a false 11-char id", () => {
    // youtu.be/<12+ chars> must not match the first 11.
    expect(extractYouTubeIds("https://youtu.be/dQw4w9WgXcQEXTRA")).toEqual([]);
  });

  it("builds canonical watch + thumbnail URLs", () => {
    expect(watchUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(defaultThumbnailUrl("dQw4w9WgXcQ")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
  });
});

describe("timedtext parsing", () => {
  it("parses cues, decodes entities, and strips inline tags", () => {
    const xml =
      '<?xml version="1.0"?><transcript>' +
      '<text start="0" dur="1.5">hello &amp; welcome</text>' +
      '<text start="1.5" dur="2">it&#39;s <b>great</b></text>' +
      "</transcript>";
    const segments = parseTimedText(xml);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({ start: 0, duration: 1.5, text: "hello & welcome" });
    expect(segments[1].text).toBe("it's great");
  });

  it("returns [] for an empty or non-XML body", () => {
    expect(parseTimedText("")).toEqual([]);
    expect(parseTimedText("not xml at all")).toEqual([]);
  });
});

describe("iso-8601 duration parsing", () => {
  it("converts hours/minutes/seconds to whole seconds", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("PT10M")).toBe(600);
    expect(parseIsoDuration("P1DT1H")).toBe(90000);
  });

  it("returns 0 for absent or unparseable input", () => {
    expect(parseIsoDuration(undefined)).toBe(0);
    expect(parseIsoDuration("garbage")).toBe(0);
  });
});

describe("brain note path", () => {
  it("slugs channel + title and dates the file", () => {
    expect(brainNotePath("My Channel!", "How to Run 4 Businesses", "2026-06-08T12:00:00Z")).toBe(
      "brain/youtube/my-channel/2026-06-08-how-to-run-4-businesses.md",
    );
  });

  it("falls back to safe slugs when channel/title are empty", () => {
    expect(brainNotePath("", "", "2026-06-08")).toBe(
      "brain/youtube/unknown-channel/2026-06-08-video.md",
    );
  });
});

describe("youtube_ingest card contract", () => {
  const video = {
    videoId: "dQw4w9WgXcQ",
    title: "A Talk",
    channel: "A Channel",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    summary: "It's about a thing.",
    brainPath: "brain/youtube/a-channel/2026-06-08-a-talk.md",
    transcriptChars: 1234,
    usedWhisper: false,
    transcriptPreview: "hello world",
    truncated: false,
  };

  it("accepts a well-formed payload and round-trips via asYouTubeIngestPayload", () => {
    const payload = { kind: YOUTUBE_INGEST_KIND, caption: "watch this", videos: [video] };
    expect(YouTubeIngestPayloadSchema.safeParse(payload).success).toBe(true);
    expect(asYouTubeIngestPayload(payload)?.videos[0].videoId).toBe("dQw4w9WgXcQ");
  });

  it("rejects a drifted blob and the upload-card kind", () => {
    expect(asYouTubeIngestPayload({ kind: "upload_result", caption: "", files: [] })).toBeNull();
    expect(asYouTubeIngestPayload(null)).toBeNull();
    expect(asYouTubeIngestPayload({ kind: YOUTUBE_INGEST_KIND, caption: "x", videos: [] })).toBeNull();
  });
});
