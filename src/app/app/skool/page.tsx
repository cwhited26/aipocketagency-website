import { createClient } from "@/lib/supabase/server";

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
      <div className="max-w-md mx-auto px-6 py-16 space-y-8">
        <div className="space-y-3">
          <div className="text-[10px] text-[#22d3ee]/50 font-mono tracking-[0.2em] uppercase">
            Community
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Skool community</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Get live feedback on your brain setup, see what other members are building, and get
            early access to new features.
          </p>
        </div>

        <a
          href={skoolUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 w-full justify-center rounded-lg px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
          style={{ background: "#22d3ee" }}
        >
          Open community →
        </a>

        <p className="text-xs text-slate-700">Opens in a new tab.</p>
      </div>
    </div>
  );
}
