import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TryThesePanel, WorksWithPanel } from "../../_components/TabGuide";
import PodcastWatchClient from "./PodcastWatchClient";

export const dynamic = "force-dynamic";

const PODCAST_PROMPTS = [
  "Drop a competitor CEO's guest spot — I'll log what they claimed about their strategy",
  "Share a Hormozi or Brunson episode — I'll pull the tactics into your voice influences",
  "Send an episode where a customer mentions your service — I'll lift the quote",
  "Forward an industry show from your field — I'll summarize it for your weekly brief",
];

// How PA turns a podcast link into a brain note — the four use-case buckets, in plain English.
const BUCKETS = [
  { label: "A competitor", does: "Logs what they actually claimed — added to your competitive intel." },
  { label: "A tactic / how-to", does: "Pulls the named techniques into your voice influences." },
  { label: "A testimonial", does: "Extracts lift-and-paste quotes for your landing page or a proposal." },
  { label: "An industry update", does: "Summarizes it and slots it into your roll-up." },
];

export default async function PodcastsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  if (!result.ok || !result.data) redirect("/app/onboarding");

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            Your agent listens to podcasts
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Podcast Ingester</h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Drop a podcast link — an Apple Podcasts page, a show&apos;s RSS feed, or a direct episode —
            and PA listens to the whole episode for you. It transcribes the audio, figures out what kind
            of episode it is, and files what matters in your brain. You get the signal without sitting
            through 90 minutes of audio.
          </p>
        </div>

        {/* How PA reads a podcast — the four buckets. */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-5">
          <div className="text-[10px] font-mono text-[#22d3ee]/60 uppercase tracking-[0.18em] mb-3">
            How PA reads a podcast
          </div>
          <ul className="flex flex-col gap-2.5">
            {BUCKETS.map((b) => (
              <li key={b.label} className="flex gap-3 text-sm leading-relaxed">
                <span className="text-slate-200 font-medium shrink-0 w-32">{b.label}</span>
                <span className="text-slate-400">{b.does}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] text-slate-500 leading-relaxed">
            Episodes are transcribed with Whisper (there&apos;s no free caption track for podcasts the
            way there is for video). Very long episodes are skipped to keep costs down unless you ask to
            transcribe them, and Spotify-exclusive shows aren&apos;t available over a public feed — share
            the show&apos;s Apple Podcasts or RSS link instead.
          </p>
        </div>

        {/* Show-watch layer (Phase 2): shows you follow, add-a-show, brain-derived suggestions, 24h chip. */}
        <div className="mt-8">
          <PodcastWatchClient />
        </div>

        {/* Vertical curation packs (Phase 4) on-ramp. */}
        <Link
          href="/app/apps/podcasts/packs"
          className="mt-8 block rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/5 px-5 py-4 hover:border-[#22d3ee]/45 transition-colors"
        >
          <p className="text-sm font-semibold text-slate-100">
            Don&apos;t want to hunt for shows? Try a pack →
          </p>
          <p className="text-sm text-slate-300 mt-1 leading-relaxed">
            Hand-picked bundles for contractors, med spas, and sales operators — follow a whole
            vertical&apos;s shows in one tap. A Studio+ add-on.
          </p>
        </Link>

        <div className="mt-8">
          <TryThesePanel heading="Try one of these" prompts={PODCAST_PROMPTS} />
        </div>

        <div className="mt-8">
          <WorksWithPanel
            items={[
              {
                href: "/app/apps/youtube",
                label: "YouTube",
                blurb: "The video cousin — drop a link and PA reads the video the same way.",
              },
              {
                href: "/app/capture",
                label: "Capture",
                blurb: "Share a podcast link from your phone — the episode lands in your brain.",
              },
              {
                href: "/app/mission-control",
                label: "Mission Control",
                blurb: "Each episode PA ingests surfaces here with what it pulled out.",
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
