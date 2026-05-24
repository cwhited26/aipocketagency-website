"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type GithubRepo = { full_name: string; private: boolean };

export default function OnboardingPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [repoInput, setRepoInput] = useState("");
  const [mode, setMode] = useState<"dropdown" | "manual">("dropdown");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSkipping, startSkipTransition] = useTransition();
  const [hasGitHub, setHasGitHub] = useState(true);

  useEffect(() => {
    fetch("/api/app/github/repos")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: GithubRepo[]) => {
        setRepos(data);
        setLoadingRepos(false);
      })
      .catch(() => {
        setLoadingRepos(false);
        setMode("manual");
        setHasGitHub(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const repo = repoInput.trim();
    if (!repo || !repo.includes("/")) {
      setError("Enter a repo in owner/name format.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/app/connect-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Failed to connect repo. Try again.");
        return;
      }
      router.push("/app/ask");
    });
  }

  function handleSkip() {
    startSkipTransition(async () => {
      await fetch("/api/app/onboarding/skip", { method: "POST" });
      router.push("/app/ask");
    });
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#05070a] px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2">
          <div className="text-[#22d3ee] text-xs font-mono tracking-[0.2em] uppercase">
            Step 1 of 1
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Set up your brain</h1>
          <p className="text-slate-400 text-sm">
            Pick the GitHub repo that holds your memory files. It should contain a{" "}
            <code className="text-[#22d3ee] text-xs bg-slate-800/60 px-1 py-0.5 rounded">
              memory/
            </code>{" "}
            folder.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "dropdown" && !loadingRepos && repos.length > 0 ? (
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Choose a repo</label>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-[#22d3ee] focus:outline-none"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
              >
                <option value="">— Select a repo —</option>
                {repos.map((r) => (
                  <option key={r.full_name} value={r.full_name}>
                    {r.full_name} {r.private ? "🔒" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-300 underline"
                onClick={() => {
                  setMode("manual");
                  setRepoInput("");
                }}
              >
                Type a repo name instead
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Brain repo (owner/name)</label>
              <input
                type="text"
                placeholder="chasewhited/whited-brain"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
              />
              {!loadingRepos && repos.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-slate-300 underline"
                  onClick={() => {
                    setMode("dropdown");
                    setRepoInput("");
                  }}
                >
                  Pick from my repos instead
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || !repoInput.trim()}
            className="w-full rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Connecting…" : "Connect brain →"}
          </button>
        </form>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 space-y-2">
          <p className="text-xs text-slate-400 font-medium">Don&apos;t have a brain repo?</p>
          <p className="text-xs text-slate-500">
            Fork the starter template to create your own brain repo, then come back and connect
            it.
          </p>
          <a
            href="https://github.com/new?template_owner=chasewhited&template_name=aipocketagency-brain"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#22d3ee] hover:underline"
          >
            Use the brain template →
          </a>
        </div>

        {/* No-repo path for email/non-GitHub users */}
        <div className="border-t border-slate-800 pt-6">
          <p className="text-sm text-slate-500 text-center mb-3">
            {hasGitHub
              ? "Not ready to connect a repo?"
              : "Signed in without GitHub? No problem."}
          </p>
          <button
            onClick={handleSkip}
            disabled={isSkipping}
            className="w-full rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSkipping ? "Setting up…" : "Continue without a brain repo →"}
          </button>
          <p className="text-xs text-slate-700 text-center mt-2">
            You can connect one later from the home screen.
          </p>
        </div>
      </div>
    </main>
  );
}
