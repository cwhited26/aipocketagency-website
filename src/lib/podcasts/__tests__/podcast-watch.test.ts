import { describe, it, expect } from "vitest";
import { newEpisodesSince, nextPollFrom } from "../watch";
import type { PodcastEpisode } from "../rss-parser";
import { cadenceForSignal, cadenceForBucket, dominantBucket } from "../suggest";
import { extractCreatorNames, extractCompetitorNames } from "../brain-signals";
import { pickShow } from "../itunes-search";
import { PODCAST_PACKS, getPodcastPack } from "../packs";
import { tierAllowsPodcastPacks } from "@/lib/personas/tier-caps";
import { USE_CASE_BUCKETS } from "@/lib/youtube/classify";

function ep(guid: string): PodcastEpisode {
  return {
    guid,
    title: guid,
    pubDateIso: "2026-06-08T10:00:00.000Z",
    durationSeconds: 1800,
    enclosureUrl: `https://cdn/${guid}.mp3`,
    enclosureType: "audio/mpeg",
    enclosureBytes: 1_000_000,
    showNotes: "notes",
  };
}

describe("newEpisodesSince (watch cursor)", () => {
  const feed = [ep("e3"), ep("e2"), ep("e1")]; // newest-first

  it("returns only the newest episode on the first poll (no cursor) — no back-catalog backfill", () => {
    expect(newEpisodesSince(feed, null).map((e) => e.guid)).toEqual(["e3"]);
  });

  it("returns episodes newer than the last-seen guid, newest-first", () => {
    expect(newEpisodesSince(feed, "e1").map((e) => e.guid)).toEqual(["e3", "e2"]);
    expect(newEpisodesSince(feed, "e2").map((e) => e.guid)).toEqual(["e3"]);
  });

  it("returns nothing when the cursor is already the newest, and [] for an empty feed", () => {
    expect(newEpisodesSince(feed, "e3")).toEqual([]);
    expect(newEpisodesSince([], "e1")).toEqual([]);
  });
});

describe("nextPollFrom (cadence scheduling)", () => {
  const base = Date.parse("2026-06-08T00:00:00.000Z");
  it("schedules realtime ~15m, daily +1d, weekly +7d out", () => {
    expect(nextPollFrom("realtime", base)).toBe("2026-06-08T00:15:00.000Z");
    expect(nextPollFrom("daily", base)).toBe("2026-06-09T00:00:00.000Z");
    expect(nextPollFrom("weekly", base)).toBe("2026-06-15T00:00:00.000Z");
  });
});

describe("suggestion cadence by signal + bucket", () => {
  it("rivals → realtime, creators → daily", () => {
    expect(cadenceForSignal("competitor")).toBe("realtime");
    expect(cadenceForSignal("creator")).toBe("daily");
  });

  it("history cadence: competitor → realtime, tactic → daily, else weekly", () => {
    expect(cadenceForBucket("competitor")).toBe("realtime");
    expect(cadenceForBucket("tactic")).toBe("daily");
    expect(cadenceForBucket("industry")).toBe("weekly");
    expect(cadenceForBucket("default")).toBe("weekly");
  });

  it("dominantBucket picks the most-seen bucket", () => {
    const buckets = { competitor: 1, tactic: 3, testimonial: 0, industry: 2, default: 0 };
    expect(dominantBucket(buckets)).toBe("tactic");
  });
});

describe("brain-signal name extraction", () => {
  it("extracts distinct title-cased creator names from voice/influences dirs", () => {
    const paths = [
      "voice/influences/hormozi/profile.md",
      "voice/influences/hormozi/quotes.md",
      "voice/influences/russell-brunson/notes.md",
      "voice/influences/README.md",
      "memory/foo.md",
    ];
    expect(extractCreatorNames(paths)).toEqual(["Hormozi", "Russell Brunson"]);
  });

  it("extracts rival names from (brain/)competitive paths, skipping readmes", () => {
    const paths = [
      "brain/competitive/acme-corp.md",
      "brain/competitive/acme-corp.md",
      "competitive/Globex/teardown.md",
      "brain/competitive/README.md",
    ];
    expect(extractCompetitorNames(paths)).toEqual(["Acme Corp", "Globex"]);
  });
});

describe("itunes search result picking", () => {
  it("picks the first result that has a feedUrl + collectionId", () => {
    const show = pickShow({
      resultCount: 2,
      results: [
        { collectionName: "No Feed Show", collectionId: 1 },
        {
          collectionId: 1254720112,
          collectionName: "The Game with Alex Hormozi",
          artistName: "Alex Hormozi",
          feedUrl: "https://feeds.captivate.fm/the-game-alex-hormozi/",
          artworkUrl600: "https://img/art.jpg",
          collectionViewUrl: "https://podcasts.apple.com/us/podcast/id1254720112",
        },
      ],
    });
    expect(show).toMatchObject({
      showId: "1254720112",
      title: "The Game with Alex Hormozi",
      feedUrl: "https://feeds.captivate.fm/the-game-alex-hormozi/",
    });
  });

  it("returns null when no result has a usable feed", () => {
    expect(pickShow({ results: [{ collectionName: "x", collectionId: 1 }] })).toBeNull();
    expect(pickShow({ results: [] })).toBeNull();
  });
});

describe("podcast vertical packs", () => {
  it("ships exactly three launch packs: contractor, med-spa, sales", () => {
    expect(PODCAST_PACKS.map((p) => p.vertical_slug)).toEqual(["contractor", "med-spa", "sales"]);
  });

  it("every pack has 5-8 shows, each with a real feed url + show id, no duplicates", () => {
    for (const pack of PODCAST_PACKS) {
      expect(pack.shows.length).toBeGreaterThanOrEqual(5);
      expect(pack.shows.length).toBeLessThanOrEqual(8);
      const ids = new Set<string>();
      for (const show of pack.shows) {
        expect(show.show_id.length).toBeGreaterThan(0);
        expect(show.feed_url.startsWith("https://")).toBe(true);
        expect(show.title.length).toBeGreaterThan(0);
        expect(ids.has(show.show_id)).toBe(false);
        ids.add(show.show_id);
      }
      expect(["realtime", "daily", "weekly"]).toContain(pack.default_cadence);
    }
  });

  it("each launch pack ships the full set of 8 curated shows", () => {
    for (const pack of PODCAST_PACKS) expect(pack.shows).toHaveLength(8);
  });

  it("getPodcastPack resolves by slug and returns null otherwise", () => {
    expect(getPodcastPack("sales")?.name).toBe("Sales & Offers");
    expect(getPodcastPack("nope")).toBeNull();
  });

  it("packs are gated to Studio+ and above", () => {
    expect(tierAllowsPodcastPacks("starter")).toBe(false);
    expect(tierAllowsPodcastPacks("studio")).toBe(false);
    expect(tierAllowsPodcastPacks("studio_plus")).toBe(true);
    expect(tierAllowsPodcastPacks("enterprise")).toBe(true);
  });
});

describe("classifier bucket set stays aligned for suggestion grouping", () => {
  it("dominantBucket handles every known bucket key", () => {
    const buckets = Object.fromEntries(USE_CASE_BUCKETS.map((b) => [b, 0])) as Record<
      (typeof USE_CASE_BUCKETS)[number],
      number
    >;
    buckets.industry = 5;
    expect(dominantBucket(buckets)).toBe("industry");
  });
});
