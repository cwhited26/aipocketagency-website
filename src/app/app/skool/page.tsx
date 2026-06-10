import { createClient } from "@/lib/supabase/server";
import { LaunchpadPrompt } from "../_components/LaunchpadPrompt";

export default async function SkoolPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? "";
  const skoolUrl = email
    ? `https://www.skool.com/ai-pocket-agency/about?email=${encodeURIComponent(email)}`
    : "https://www.skool.com/ai-pocket-agency/about";

  return (
    <div className="h-full overflow-y-auto bg-[#05070a]">
      <div className="max-w-md mx-auto px-6 py-16 space-y-6">
        <div className="space-y-3">
          <div className="text-[10px] text-[#22d3ee]/50 font-mono tracking-[0.2em] uppercase">
            Community
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Pocket Agent Launchpad</h1>
        </div>

        {/* Part 7S: in-app Launchpad join prompt. Join state isn't tracked yet, so we always show the
            not-joined pitch; the CTA points at the owner's Skool join URL. */}
        <LaunchpadPrompt joined={false} href={skoolUrl} />
      </div>
    </div>
  );
}
