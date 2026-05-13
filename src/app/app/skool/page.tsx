import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

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
    <main className="min-h-screen bg-[#05070a] flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-3">
          <div className="text-[#22d3ee] text-xs font-mono tracking-[0.2em] uppercase">
            Community
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Join the Skool community</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Get live feedback on your brain setup, see what other members are building, and get
            early access to new Pocket Agent features.
          </p>
        </div>

        <a
          href={skoolUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-[#22d3ee] px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
        >
          Open community →
        </a>

        <p className="text-xs text-slate-600">
          Opens in a new tab.{" "}
          <Link href="/app/ask" className="text-slate-500 hover:text-slate-300 underline">
            Back to ask
          </Link>
        </p>
      </div>
    </main>
  );
}
