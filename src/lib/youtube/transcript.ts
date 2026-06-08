// transcript.ts — fetch a video's caption track from YouTube's public timedtext endpoint.
//
// Direct REST, free, no key:  https://www.youtube.com/api/timedtext?v=<id>&lang=en
// The endpoint returns timed-text XML (<transcript><text start=".." dur="..">words</text>…</transcript>)
// when a caption track exists, or an empty body when it doesn't. We try the published track first,
// then the auto-generated (kind=asr) track, and return null when neither yields captions — the
// caller (ingest.ts) then falls back to the Whisper audio path.

export type TranscriptSegment = {
  /** Start offset of the cue, in seconds. */
  start: number;
  /** Duration of the cue, in seconds. */
  duration: number;
  /** The cue text, HTML-decoded and whitespace-collapsed. */
  text: string;
};

export type Transcript = {
  segments: TranscriptSegment[];
  /** All cues joined with spaces — the body written to the brain note + read by the agent. */
  full_text: string;
};

// timedtext cues HTML-escape their text (&amp; &#39; &quot; …) and sometimes carry nested tags. We
// decode the handful of entities the endpoint actually emits; anything else passes through verbatim.
function decodeEntities(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "") // strip any inline formatting tags inside a cue
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses timedtext XML into segments. Exported so the parser is unit-testable without a network
 * call. Returns [] when the body has no <text> cues (empty track / not XML).
 */
export function parseTimedText(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const cue = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = cue.exec(xml)) !== null) {
    const attrs = match[1];
    const startMatch = /\bstart="([\d.]+)"/.exec(attrs);
    const durMatch = /\bdur="([\d.]+)"/.exec(attrs);
    const text = decodeEntities(match[2]);
    if (!text) continue;
    segments.push({
      start: startMatch ? Number(startMatch[1]) : 0,
      duration: durMatch ? Number(durMatch[1]) : 0,
      text,
    });
  }
  return segments;
}

async function fetchTrack(videoId: string, lang: string, asr: boolean): Promise<string | null> {
  const params = new URLSearchParams({ v: videoId, lang });
  if (asr) params.set("kind", "asr");
  const url = `https://www.youtube.com/api/timedtext?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "pocket-agent/1.0", "Accept-Language": `${lang},en;q=0.8` },
      cache: "no-store",
    });
  } catch {
    // Network failure on a free best-effort endpoint isn't fatal — the Whisper fallback can still
    // run. Return null (not an error) so the caller treats it as "no captions here".
    return null;
  }
  if (!res.ok) return null;
  const body = await res.text();
  return body.trim().length > 0 ? body : null;
}

/**
 * Returns the video's transcript from the timedtext endpoint, or null when no caption track is
 * available in the requested language (published or auto-generated). Never throws.
 */
export async function fetchTranscript(
  videoId: string,
  lang = "en",
): Promise<Transcript | null> {
  // Published track first, then the auto-generated (ASR) track.
  const body = (await fetchTrack(videoId, lang, false)) ?? (await fetchTrack(videoId, lang, true));
  if (!body) return null;

  const segments = parseTimedText(body);
  if (segments.length === 0) return null;

  const full_text = segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
  if (!full_text) return null;

  return { segments, full_text };
}
