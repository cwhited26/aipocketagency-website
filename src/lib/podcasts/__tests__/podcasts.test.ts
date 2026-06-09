import { describe, it, expect } from "vitest";
import { extractPodcastUrls, classifyPodcastUrl, containsPodcastUrl } from "../detect";
import { parseDuration, parseFeed, selectEpisode } from "../rss-parser";
import { brainNotePath, allowLongFor } from "../ingest";
import { PODCAST_BUCKET_FRAMINGS } from "../classify";
import { USE_CASE_BUCKETS } from "@/lib/youtube/classify";
import { PodcastIngestPayloadSchema, asPodcastIngestPayload, PODCAST_INGEST_KIND } from "../card";

describe("podcast url detection", () => {
  it("classifies Apple Podcasts show + episode links", () => {
    const show = classifyPodcastUrl("https://podcasts.apple.com/us/podcast/the-game/id1254863997");
    expect(show).toEqual({ kind: "apple", url: "https://podcasts.apple.com/us/podcast/the-game/id1254863997", appleId: "1254863997", appleEpisodeId: null });
    const ep = classifyPodcastUrl("https://podcasts.apple.com/us/podcast/the-game/id1254863997?i=1000600000000");
    expect(ep).toMatchObject({ kind: "apple", appleId: "1254863997", appleEpisodeId: "1000600000000" });
  });

  it("flags Spotify show/episode links so the resolver can refuse honestly", () => {
    expect(classifyPodcastUrl("https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk")).toMatchObject({
      kind: "spotify",
      spotifyType: "show",
      spotifyId: "4rOoJ6Egrf8K2IrywzwOMk",
    });
    expect(classifyPodcastUrl("https://open.spotify.com/episode/abc123")).toMatchObject({ kind: "spotify", spotifyType: "episode" });
  });

  it("recognizes RSS feeds and direct audio enclosures", () => {
    expect(classifyPodcastUrl("https://feeds.megaphone.fm/thegame")?.kind).toBe("rss");
    expect(classifyPodcastUrl("https://example.com/podcast/feed.xml")?.kind).toBe("rss");
    expect(classifyPodcastUrl("https://cdn.example.com/eps/episode-42.mp3?token=x")?.kind).toBe("audio");
  });

  it("ignores ordinary web links and pulls a link out of prose", () => {
    expect(classifyPodcastUrl("https://example.com/blog/post")).toBeNull();
    expect(extractPodcastUrls("loved this episode https://podcasts.apple.com/us/podcast/x/id42 — listen")).toEqual([
      { kind: "apple", url: "https://podcasts.apple.com/us/podcast/x/id42", appleId: "42", appleEpisodeId: null },
    ]);
    expect(containsPodcastUrl("just words")).toBe(false);
  });

  it("dedupes the same link and returns [] for empty input", () => {
    const text = "https://feeds.megaphone.fm/a and again https://feeds.megaphone.fm/a";
    expect(extractPodcastUrls(text)).toHaveLength(1);
    expect(extractPodcastUrls("")).toEqual([]);
  });
});

describe("itunes:duration parsing", () => {
  it("parses seconds, MM:SS, and HH:MM:SS", () => {
    expect(parseDuration("3600")).toBe(3600);
    expect(parseDuration("12:34")).toBe(754);
    expect(parseDuration("1:02:03")).toBe(3723);
  });
  it("returns 0 for absent or unparseable input", () => {
    expect(parseDuration("")).toBe(0);
    expect(parseDuration("garbage")).toBe(0);
  });
});

describe("rss 2.0 feed parsing", () => {
  const feed =
    '<?xml version="1.0"?><rss><channel>' +
    "<title>The Show</title><itunes:author>Jane Host</itunes:author>" +
    '<itunes:image href="https://img/art.jpg"/><description>A show about things.</description>' +
    "<item><title>Newer &amp; Better</title><guid>guid-new</guid>" +
    "<pubDate>Mon, 08 Jun 2026 10:00:00 GMT</pubDate><itunes:duration>1:30:00</itunes:duration>" +
    '<enclosure url="https://cdn/ep-new.mp3" length="48000000" type="audio/mpeg"/>' +
    "<description><![CDATA[<p>Show <b>notes</b> here.</p>]]></description></item>" +
    "<item><title>Older</title><guid>guid-old</guid>" +
    "<pubDate>Sun, 07 Jun 2026 10:00:00 GMT</pubDate><itunes:duration>2700</itunes:duration>" +
    '<enclosure url="https://cdn/ep-old.mp3" length="20000000" type="audio/mpeg"/></item>' +
    "</channel></rss>";

  it("extracts show metadata and episodes in feed order", () => {
    const parsed = parseFeed(feed);
    expect(parsed.show.title).toBe("The Show");
    expect(parsed.show.host).toBe("Jane Host");
    expect(parsed.show.artworkUrl).toBe("https://img/art.jpg");
    expect(parsed.episodes).toHaveLength(2);
    const [newer, older] = parsed.episodes;
    expect(newer.title).toBe("Newer & Better");
    expect(newer.guid).toBe("guid-new");
    expect(newer.durationSeconds).toBe(5400);
    expect(newer.enclosureUrl).toBe("https://cdn/ep-new.mp3");
    expect(newer.enclosureBytes).toBe(48000000);
    expect(newer.showNotes).toBe("Show notes here.");
    expect(older.durationSeconds).toBe(2700);
  });

  it("selects newest by default, the named episode by guid, and returns null for an empty feed", () => {
    const { episodes } = parseFeed(feed);
    expect(selectEpisode(episodes, null, null)?.guid).toBe("guid-new");
    expect(selectEpisode(episodes, "guid-old", null)?.guid).toBe("guid-old");
    expect(selectEpisode(episodes, null, "Older")?.guid).toBe("guid-old");
    expect(selectEpisode([], null, null)).toBeNull();
  });

  it("returns no episodes for a non-feed body", () => {
    expect(parseFeed("not a feed").episodes).toEqual([]);
  });
});

describe("brain note path + bucket routing", () => {
  it("slugs show + title and dates the file under brain/podcasts", () => {
    expect(brainNotePath("The Game!", "How to Price a Service", "2026-06-08T12:00:00Z")).toBe(
      "brain/podcasts/the-game/2026-06-08-how-to-price-a-service.md",
    );
  });

  it("falls back to safe slugs when show/title are empty", () => {
    expect(brainNotePath("", "", "2026-06-08")).toBe("brain/podcasts/unknown-show/2026-06-08-episode.md");
  });

  it("routes competitor/tactic/testimonial to shared areas, industry/default to brain/podcasts", () => {
    expect(PODCAST_BUCKET_FRAMINGS.competitor.brainDir).toBe("brain/competitive");
    expect(PODCAST_BUCKET_FRAMINGS.tactic.brainDir).toBe("brain/voice/influences");
    expect(PODCAST_BUCKET_FRAMINGS.testimonial.brainDir).toBe("brain/testimonials");
    expect(PODCAST_BUCKET_FRAMINGS.industry.brainDir).toBe("brain/podcasts");
    expect(PODCAST_BUCKET_FRAMINGS.default.brainDir).toBe("brain/podcasts");
  });

  it("has a framing for every YouTube bucket (so the wrapper stays in sync)", () => {
    for (const bucket of USE_CASE_BUCKETS) {
      const f = PODCAST_BUCKET_FRAMINGS[bucket];
      expect(f.headline.length).toBeGreaterThan(0);
      expect(f.brainDir.startsWith("brain/")).toBe(true);
      expect(f.detailLabel.length).toBeGreaterThan(0);
    }
  });
});

describe("long-episode override phrase", () => {
  it("detects the opt-in phrases, ignores ordinary text", () => {
    expect(allowLongFor("transcribe long episodes please")).toBe(true);
    expect(allowLongFor("allow long")).toBe(true);
    expect(allowLongFor("what did they say about pricing")).toBe(false);
  });
});

describe("podcast_ingest card contract", () => {
  const episode = {
    episodeId: "guid-new",
    title: "An Episode",
    show: "The Show",
    host: "Jane Host",
    bucket: "tactic" as const,
    framingHeadline: "Pulled the techniques into your voice influences.",
    detailLabel: "Techniques",
    bucketDetail: "- Hook-Story-Offer",
    artworkUrl: "https://img/art.jpg",
    url: "https://podcasts.apple.com/us/podcast/x/id42",
    summary: "It's about a thing.",
    brainPath: "brain/voice/influences/the-show/2026-06-08-an-episode.md",
    mode: "full_transcript" as const,
    transcriptChars: 1234,
    durationSeconds: 5400,
    transcriptPreview: "hello world",
    truncated: false,
  };

  it("accepts a well-formed payload and round-trips via asPodcastIngestPayload", () => {
    const payload = { kind: PODCAST_INGEST_KIND, caption: "listen to this", episodes: [episode] };
    expect(PodcastIngestPayloadSchema.safeParse(payload).success).toBe(true);
    expect(asPodcastIngestPayload(payload)?.episodes[0].episodeId).toBe("guid-new");
  });

  it("rejects a drifted blob, the youtube card kind, and an empty episode list", () => {
    expect(asPodcastIngestPayload({ kind: "youtube_ingest", caption: "", videos: [] })).toBeNull();
    expect(asPodcastIngestPayload(null)).toBeNull();
    expect(asPodcastIngestPayload({ kind: PODCAST_INGEST_KIND, caption: "x", episodes: [] })).toBeNull();
  });
});
