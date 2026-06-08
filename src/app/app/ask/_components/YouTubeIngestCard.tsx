"use client";

// YouTubeIngestCard — renders the youtube_ingest inline card in the Ask box thread. When a YouTube
// link arrives in chat, the transcript + metadata are pulled and a clean note is written to the
// brain; this card shows the thumbnail, title, channel, the one-paragraph summary, and a "View
// transcript" expander. The transcript + summary also ride in the message body, so the agent answers
// about the video directly.

import { useState } from "react";
import type { YouTubeIngestPayload, YouTubeIngestVideo } from "@/lib/youtube/card";

function VideoBlock({ video }: { video: YouTubeIngestVideo }) {
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 overflow-hidden">
      <div className="flex gap-3 p-2.5">
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote i.ytimg.com thumbnail; next/image isn't configured for it.
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-28 h-16 rounded-md object-cover border border-slate-700/60 bg-[#0b1016] shrink-0"
          />
        ) : (
          <div className="w-28 h-16 rounded-md border border-slate-700/60 bg-[#0b1016] flex items-center justify-center shrink-0">
            <span className="text-[10px] font-mono text-slate-500">YOUTUBE</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-slate-200 font-medium leading-snug line-clamp-2 hover:text-[#22d3ee] transition-colors"
          >
            {video.title}
          </a>
          <p className="mt-0.5 text-[11px] font-mono text-slate-500 truncate">{video.channel}</p>
          {video.summary && (
            <p className="mt-1 text-[12px] text-slate-400 leading-snug line-clamp-3">{video.summary}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-slate-800/60 px-3 py-1.5">
        <button
          onClick={() => setShowTranscript((v) => !v)}
          className="text-[11px] font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors"
        >
          {showTranscript ? "Hide transcript" : "View transcript"}
        </button>
        <span className="text-[10px] font-mono text-slate-600">
          {video.transcriptChars.toLocaleString()} chars
          {video.usedWhisper ? " · from audio" : " · captions"}
        </span>
      </div>
      {showTranscript && (
        <pre className="max-h-56 overflow-auto border-t border-slate-800/60 bg-[#0b1016] px-3 py-2 text-[11px] leading-relaxed text-slate-400 whitespace-pre-wrap">
          {video.transcriptPreview}
          {video.truncated ? "\n\n…transcript truncated — full text saved to your brain." : ""}
        </pre>
      )}
    </div>
  );
}

export default function YouTubeIngestCard({ payload }: { payload: YouTubeIngestPayload }) {
  return (
    <div className="max-w-[85%] flex flex-col gap-2 items-end">
      {payload.caption && (
        <div className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-slate-100 whitespace-pre-wrap bg-slate-800 border border-slate-700/60">
          {payload.caption}
        </div>
      )}
      <div className="w-full flex flex-col gap-1.5">
        {payload.videos.map((video, i) => (
          <VideoBlock key={`${video.videoId}-${i}`} video={video} />
        ))}
      </div>
      <p className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
        <span className="text-[#22d3ee]">●</span>
        {payload.videos.length > 1
          ? "Transcribed + saved to your brain — the agent can see these."
          : "Transcribed + saved to your brain — the agent can see this."}
      </p>
    </div>
  );
}
