import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import YouTubeExplainerCard from "@/components/youtube/ExplainerCard";
import { TryThesePanel, WorksWithPanel } from "../../_components/TabGuide";

export const dynamic = "force-dynamic";

const YOUTUBE_PROMPTS = [
  "Drop a competitor's product launch video here — I'll log what they actually claimed",
  "Share a Russell Brunson or Hormozi clip — I'll add the techniques to your voice influences",
  "Send a customer testimonial video — I'll pull the quotes for your landing page",
  "Forward an industry update from a contractor channel — I'll summarize and roll it into your weekly brief",
];

export default async function YouTubePage() {
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
            Your agent watches YouTube
          </div>
          <h1 className="text-2xl font-bold text-slate-100">YouTube</h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Drop a link and PA reads the video. Watch a channel and PA catches every new upload — so
            you&apos;re never the last to know what a competitor claimed or a creator taught.
          </p>
        </div>

        <YouTubeExplainerCard showWatchLink={false} />

        <div className="mt-8">
          <TryThesePanel heading="Try one of these" prompts={YOUTUBE_PROMPTS} />
        </div>

        <div className="mt-8">
          <WorksWithPanel
            items={[
              {
                href: "/app/capture",
                label: "Capture",
                blurb: "Share a link from your phone or paste one — every video lands in your brain.",
              },
              {
                href: "/app/mission-control",
                label: "Mission Control",
                blurb: "New ingests from your watched channels surface here as they arrive.",
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
