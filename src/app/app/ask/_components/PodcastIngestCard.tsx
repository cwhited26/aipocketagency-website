"use client";

// PodcastIngestCard — renders the podcast_ingest inline card in the Ask box thread. When a podcast link
// arrives in chat, PA pulls the episode audio, transcribes it (Whisper), classifies it into a use-case
// bucket, and writes a clean note to the brain; this card shows the show artwork, episode title,
// show/host, the bucket-specific lead ("what PA did with it"), the extraction, and a "View transcript"
// expander. The transcript + summary also ride in the message body, so the agent answers about the
// episode directly. Mirrors YouTubeIngestCard (the channel-watch affordance lands with Phase 2).

import { useState } from "react";
import type { PodcastIngestPayload, PodcastIngestEpisode } from "@/lib/podcasts/card";

function durationLabel(seconds: number): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function EpisodeBlock({ episode }: { episode: PodcastIngestEpisode }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const dur = durationLabel(episode.durationSeconds);

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 overflow-hidden">
      <div className="flex gap-3 p-2.5">
        {episode.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote podcast artwork; next/image isn't configured for arbitrary feed hosts.
          <img
            src={episode.artworkUrl}
            alt={episode.show}
            className="w-16 h-16 rounded-md object-cover border border-slate-700/60 bg-[#0b1016] shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-md border border-slate-700/60 bg-[#0b1016] flex items-center justify-center shrink-0">
            <span className="text-[10px] font-mono text-slate-500">POD</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <a
            href={episode.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-slate-200 font-medium leading-snug line-clamp-2 hover:text-[#22d3ee] transition-colors"
          >
            {episode.title}
          </a>
          <p className="mt-0.5 text-[11px] font-mono text-slate-500 truncate">
            {episode.show}
            {episode.host ? ` · ${episode.host}` : ""}
          </p>
          {/* The bucket-specific lead — what PA actually did with the episode. */}
          <p className="mt-1 text-[11px] font-medium text-[#22d3ee]/80 leading-snug">{episode.framingHeadline}</p>
        </div>
      </div>
      {episode.bucketDetail && (
        <div className="border-t border-slate-800/60 px-3 py-2">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{episode.detailLabel}</p>
          <p className="mt-1 text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap">{episode.bucketDetail}</p>
        </div>
      )}
      <div className="flex items-center gap-3 border-t border-slate-800/60 px-3 py-1.5">
        <button
          onClick={() => setShowTranscript((v) => !v)}
          className="text-[11px] font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors"
        >
          {showTranscript ? "Hide transcript" : "View transcript"}
        </button>
        <span className="text-[10px] font-mono text-slate-600">
          {episode.transcriptChars.toLocaleString()} chars
          {dur ? ` · ${dur}` : ""} · transcribed from audio
        </span>
      </div>
      {showTranscript && (
        <pre className="max-h-56 overflow-auto border-t border-slate-800/60 bg-[#0b1016] px-3 py-2 text-[11px] leading-relaxed text-slate-400 whitespace-pre-wrap">
          {episode.transcriptPreview}
          {episode.truncated ? "\n\n…transcript truncated — full text saved to your brain." : ""}
        </pre>
      )}
    </div>
  );
}

export default function PodcastIngestCard({ payload }: { payload: PodcastIngestPayload }) {
  return (
    <div className="max-w-[85%] flex flex-col gap-2 items-end">
      {payload.caption && (
        <div className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-slate-100 whitespace-pre-wrap bg-slate-800 border border-slate-700/60">
          {payload.caption}
        </div>
      )}
      <div className="w-full flex flex-col gap-1.5">
        {payload.episodes.map((episode, i) => (
          <EpisodeBlock key={`${episode.episodeId}-${i}`} episode={episode} />
        ))}
      </div>
      <p className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
        <span className="text-[#22d3ee]">●</span>
        {payload.episodes.length > 1
          ? "Listened + saved to your brain — the agent can see these."
          : "Listened + saved to your brain — the agent can see this."}
      </p>
    </div>
  );
}
