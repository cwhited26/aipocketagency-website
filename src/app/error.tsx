"use client";

// error.tsx — the app-wide error boundary (PA-POS-33 gave it a face). Renders inside the
// root layout when a route segment throws, so global styles apply. Poc owns the miss in
// character — voice per voice/poc-character-bio.md ("That miss is on me. Redo?") — and the
// reset button re-renders the segment. Next.js logs the underlying error; the digest shown
// here is the correlation handle for that log line.

import Image from "next/image";
import Link from "next/link";
import { pocArtSrc } from "@/lib/personas/poc-variants";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center text-slate-100">
      <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#0a1f28]">
        <Image src={pocArtSrc("default")} width={96} height={96} alt="Poc" />
      </span>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">
        That miss is on me. Redo?
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
        Something broke on this screen. Nothing you approved was lost — hit Redo
        and I&apos;ll load it again.
      </p>
      <div className="mt-7 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground transition hover:scale-[1.02]"
        >
          Redo
        </button>
        <Link
          href="/"
          className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-white/30"
        >
          Back home
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 font-mono text-[11px] text-slate-600">
          ref {error.digest}
        </p>
      )}
    </main>
  );
}
