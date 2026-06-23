// connectors/recall-ai/client.ts — direct REST client for the Recall.ai meeting-bot API (Meeting
// Persona, MP-CORE-1). No SDK (repo SDK ban). Auth is the owner's per-account Recall API key, passed
// in by the caller (the executor decrypts it from the connection row on each call — see actions.ts).
//
// Region note: Recall.ai is region-partitioned (us-east-1, us-west-2, eu-central-1, ap-northeast-1).
// The base URL MUST match the region the owner's Recall workspace lives in. Default is us-east-1;
// override with RECALL_API_BASE_URL when a workspace is in another region. (Per-owner region routing
// is an MP-CORE-2 concern; foundation uses one configured region.)

import {
  BotIdInputSchema,
  RecallBotSchema,
  RecallTranscriptSchema,
  SpawnBotInputSchema,
  type BotIdInput,
  type MeetingProvider,
  type RecallBot,
  type RecallTranscript,
  type SpawnBotInput,
} from "./types";
import { log } from "./log";

const DEFAULT_BASE_URL = "https://us-east-1.recall.ai/api/v1";

export function recallBaseUrl(): string {
  return (process.env.RECALL_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

export type RecallResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

type RecallRequest = {
  apiKey: string;
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
};

/** Single transport seam: Token auth, JSON, no caching. Returns the parsed JSON body as unknown. */
async function recallFetch(req: RecallRequest): Promise<RecallResult<unknown>> {
  let res: Response;
  try {
    res = await fetch(`${recallBaseUrl()}${req.path}`, {
      method: req.method,
      headers: {
        // Recall.ai uses the DRF Token scheme, not Bearer.
        Authorization: `Token ${req.apiKey}`,
        Accept: "application/json",
        ...(req.body ? { "Content-Type": "application/json" } : {}),
      },
      body: req.body ? JSON.stringify(req.body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      error: e instanceof Error ? e.message : "network error",
      authError: false,
    };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: res.status, error: "Recall.ai rejected the API key.", authError: true };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text || `Recall.ai error ${res.status}`, authError: false };
  }

  // 204 / empty body (e.g. leave_call) — nothing to parse.
  if (res.status === 204) return { ok: true, data: null };
  const text = await res.text().catch(() => "");
  if (!text) return { ok: true, data: null };
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 502, error: "Recall.ai returned a non-JSON body.", authError: false };
  }
}

/**
 * Validate an API key for the /connect flow. Recall has no dedicated health endpoint; listing one
 * bot is the standard authenticated probe — 200 means the key works, 401/403 means it's rejected.
 */
export async function validateApiKey(apiKey: string): Promise<RecallResult<true>> {
  const res = await recallFetch({ apiKey, method: "GET", path: "/bot/?limit=1" });
  if (!res.ok) return res;
  return { ok: true, data: true };
}

/** Spawn a bot into a meeting. (recordingMode is carried in session metadata for MP-CORE-1; the
 *  Recall recording_config — transcript provider + audio retention — is wired in MP-CORE-2/3.) */
export async function spawnBot(
  input: SpawnBotInput & { apiKey: string },
): Promise<RecallResult<RecallBot>> {
  const parsed = SpawnBotInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, error: parsed.error.message, authError: false };
  }
  const body: Record<string, unknown> = { meeting_url: parsed.data.meetingUrl };
  if (parsed.data.botName) body.bot_name = parsed.data.botName;

  const res = await recallFetch({ apiKey: input.apiKey, method: "POST", path: "/bot/", body });
  if (!res.ok) return res;
  const bot = RecallBotSchema.safeParse(res.data);
  if (!bot.success) {
    log.error("spawnBot: unexpected Recall response shape", { error: bot.error.message });
    return { ok: false, status: 502, error: "Recall.ai returned an unexpected bot shape.", authError: false };
  }
  return { ok: true, data: bot.data };
}

/** Pull the bot out of the meeting. */
export async function leaveBot(
  input: BotIdInput & { apiKey: string },
): Promise<RecallResult<true>> {
  const parsed = BotIdInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, error: parsed.error.message, authError: false };
  }
  const res = await recallFetch({
    apiKey: input.apiKey,
    method: "POST",
    path: `/bot/${encodeURIComponent(parsed.data.botId)}/leave_call/`,
  });
  if (!res.ok) return res;
  return { ok: true, data: true };
}

/** Fetch the current bot object (status, recordings, metadata). */
export async function getBot(
  input: BotIdInput & { apiKey: string },
): Promise<RecallResult<RecallBot>> {
  const parsed = BotIdInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, error: parsed.error.message, authError: false };
  }
  const res = await recallFetch({
    apiKey: input.apiKey,
    method: "GET",
    path: `/bot/${encodeURIComponent(parsed.data.botId)}/`,
  });
  if (!res.ok) return res;
  const bot = RecallBotSchema.safeParse(res.data);
  if (!bot.success) {
    log.error("getBot: unexpected Recall response shape", { error: bot.error.message });
    return { ok: false, status: 502, error: "Recall.ai returned an unexpected bot shape.", authError: false };
  }
  return { ok: true, data: bot.data };
}

/** Fetch the speaker-segmented transcript for a bot's recording. */
export async function getTranscript(
  input: BotIdInput & { apiKey: string },
): Promise<RecallResult<RecallTranscript>> {
  const parsed = BotIdInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, error: parsed.error.message, authError: false };
  }
  const res = await recallFetch({
    apiKey: input.apiKey,
    method: "GET",
    path: `/bot/${encodeURIComponent(parsed.data.botId)}/transcript/`,
  });
  if (!res.ok) return res;
  const transcript = RecallTranscriptSchema.safeParse(res.data);
  if (!transcript.success) {
    log.error("getTranscript: unexpected Recall response shape", { error: transcript.error.message });
    return { ok: false, status: 502, error: "Recall.ai returned an unexpected transcript shape.", authError: false };
  }
  return { ok: true, data: transcript.data };
}

/** Resolve a playable recording URL for a bot, when one exists yet. Derived from the bot object. */
export async function getRecordingUrl(
  input: BotIdInput & { apiKey: string },
): Promise<RecallResult<string | null>> {
  const bot = await getBot(input);
  if (!bot.ok) return bot;
  const url = typeof bot.data.video_url === "string" ? bot.data.video_url : null;
  return { ok: true, data: url };
}

/** Infer the meeting provider from the meeting URL host (best-effort; falls back to 'other'). */
export function inferMeetingProvider(meetingUrl: string): MeetingProvider {
  let host: string;
  try {
    host = new URL(meetingUrl).host.toLowerCase();
  } catch {
    return "other";
  }
  if (host.includes("zoom.")) return "zoom";
  if (host.includes("meet.google.")) return "meet";
  if (host.includes("teams.microsoft.") || host.includes("teams.live.")) return "teams";
  return "other";
}
