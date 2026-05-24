import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import MagicLinkForm from "./MagicLinkForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app/onboarding");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#05070a] px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="text-[#22d3ee] text-xs font-mono tracking-[0.2em] uppercase">
            Pocket Agent
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Sign in</h1>
          <p className="text-slate-400 text-sm">
            Use email or GitHub to access your brain.
          </p>
        </div>

        {searchParams.error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 text-center">
            {searchParams.error === "no_code"
              ? "Sign-in failed. Please try again."
              : searchParams.error}
          </div>
        )}

        <MagicLinkForm />

        <div className="relative flex items-center gap-3">
          <div className="flex-1 border-t border-slate-800" />
          <span className="text-xs text-slate-600">or</span>
          <div className="flex-1 border-t border-slate-800" />
        </div>

        <div className="space-y-2">
          <Link
            href="/api/app/auth/github"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-100 hover:bg-slate-700 hover:border-slate-600 transition-colors"
          >
            <GitHubIcon />
            Continue with GitHub
          </Link>
          <p className="text-center text-xs text-slate-600">
            GitHub is required to connect a brain repo.
          </p>
        </div>

        <p className="text-center text-xs text-slate-600">
          Need a subscription?{" "}
          <Link href="/pocket-agent" className="text-[#22d3ee] hover:underline">
            Get started →
          </Link>
        </p>
      </div>
    </main>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}
