import Link from "next/link";

export function PocketCaptureFooter() {
  return (
    <footer className="bg-black/40">
      <div className="mx-auto max-w-4xl px-6 py-14">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-[15px] font-semibold text-slate-100">Pocket Capture</div>
          <p className="max-w-md text-sm leading-relaxed text-slate-500">
            The lowest-friction way to get something out of your head and into a feed that’s
            yours — by Pocket Agent.
          </p>
          <a
            href="https://aipocketagent.com"
            className="text-sm text-cyan-300 transition hover:underline"
          >
            Pocket Agent → aipocketagent.com
          </a>
          <nav className="mt-2 flex items-center gap-5 text-sm text-slate-500">
            <Link href="/privacy" className="transition hover:text-slate-300">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-slate-300">
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
