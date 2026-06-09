// hooks.ts — the one entry point every inbound surface calls: maybeIngestPodcastUrls(text, ownerId,
// source). It detects every podcast link in the text, resolves the owner's brain + key, and ingests
// each (capped). Surfaces fold the ok results' contextBlocks into the agent's turn and render the card
// from buildPodcastCardPayload. The heavy lifting lives in ./ingest; this file is the surface seam.

import { extractPodcastUrls } from "./detect";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  ingestPodcastEpisode,
  allowLongFor,
  type InboundSurface,
  type PodcastIngestResult,
  type PodcastOwnerContext,
} from "./ingest";

export {
  buildPodcastCardPayload,
  buildPodcastContextAppend,
  summarizePodcastForReply,
  type PodcastIngestResult,
  type InboundSurface,
} from "./ingest";

/** Cap on episodes ingested from one message — bounds Whisper cost when a message dumps many links. */
export const MAX_EPISODES_PER_MESSAGE = 3;

/**
 * Detects every podcast link in `text` and ingests each for `ownerId`, returning one result per link
 * (capped at MAX_EPISODES_PER_MESSAGE). Returns [] when the text has no podcast link — so a surface can
 * call this on every inbound message at near-zero cost. Every inbound surface calls this.
 */
export async function maybeIngestPodcastUrls(
  text: string,
  ownerId: string,
  source: InboundSurface,
): Promise<PodcastIngestResult[]> {
  const refs = extractPodcastUrls(text);
  if (refs.length === 0) return [];

  const paResult = await fetchPaUser(ownerId);
  if (!paResult.ok || !paResult.data) {
    return refs.map((ref) => ({ ok: false as const, url: ref.url, error: "Couldn't load your account to save the episode." }));
  }
  const paUser = paResult.data;
  if (!paUser.brain_repo || !paUser.github_token) {
    return refs.map((ref) => ({
      ok: false as const,
      url: ref.url,
      error: "Connect your brain in Settings before I can save an episode transcript.",
    }));
  }

  const ctx: PodcastOwnerContext = {
    ownerId,
    repo: paUser.brain_repo,
    token: paUser.github_token,
    anthropicApiKey: paUser.anthropic_api_key,
  };
  const allowLong = allowLongFor(text);

  const results: PodcastIngestResult[] = [];
  for (const ref of refs.slice(0, MAX_EPISODES_PER_MESSAGE)) {
    results.push(await ingestPodcastEpisode({ ref, source, ctx, allowLong }));
  }
  return results;
}
