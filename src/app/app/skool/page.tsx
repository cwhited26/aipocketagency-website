import { SKOOL_URL } from "@/lib/constants/skool";
import { LaunchpadPrompt } from "../_components/LaunchpadPrompt";

export default function SkoolPage() {
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
            not-joined pitch; the CTA points at the real Skool community URL (opens in a new tab). */}
        <LaunchpadPrompt joined={false} href={SKOOL_URL} />
      </div>
    </div>
  );
}
