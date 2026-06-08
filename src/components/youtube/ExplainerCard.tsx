// ExplainerCard — "How PA reads YouTube". The discoverability card that tells a non-engineer owner
// the full story of what dropping a YouTube link does, with one concrete example per use-case bucket.
// Rendered on the Apps tab, the Capture page, and the dedicated YouTube surface. Presentational +
// server-safe (no hooks). Same Russell-COS pattern as the every-tab rewrite: tell the story, show
// examples, point at where it works.

import Link from "next/link";

type Bucket = {
  tag: string;
  example: string;
};

const BUCKETS: Bucket[] = [
  {
    tag: "Competitor / launch / news",
    example: "Drop a competitor's product launch — PA logs what they actually claimed (price, positioning, dates) into your competitive intel.",
  },
  {
    tag: "Tactics from creators",
    example: "Share a Russell Brunson or Alex Hormozi clip — PA pulls the named techniques into your voice influences.",
  },
  {
    tag: "Customer testimonial",
    example: "Send a testimonial or case-study video — PA extracts 3–5 lift-and-paste quotes with timestamps for your landing page.",
  },
  {
    tag: "Industry update / podcast",
    example: "Forward an industry update — PA summarizes it into your daily roll-up and flags the one moment that matters.",
  },
];

export default function YouTubeExplainerCard({
  showWatchLink = true,
}: {
  /** When true, footer links to the YouTube surface (where channel-watch lives). */
  showWatchLink?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-5 py-5">
      <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-1.5">
        How PA reads YouTube
      </div>
      <h3 className="text-base font-semibold text-slate-100">Send PA a YouTube link, get back signal.</h3>
      <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
        Paste a link anywhere you talk to PA — the chat box, a text, an email, Slack. PA watches the
        video for you, files a clean note in your brain, and answers like it sat through the whole
        thing. What it pulls depends on what kind of video it is:
      </p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {BUCKETS.map((b) => (
          <li key={b.tag} className="flex items-start gap-3">
            <span className="shrink-0 text-[#22d3ee]/60 mt-0.5 text-sm">◆</span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-200">{b.tag}</p>
              <p className="text-[13px] text-slate-400 leading-relaxed mt-0.5">{b.example}</p>
            </div>
          </li>
        ))}
      </ul>
      {showWatchLink && (
        <div className="mt-4 pt-3 border-t border-slate-800/60">
          <Link
            href="/app/apps/youtube"
            className="text-[12px] font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors"
          >
            Watch channels so PA catches new videos automatically →
          </Link>
        </div>
      )}
    </div>
  );
}
