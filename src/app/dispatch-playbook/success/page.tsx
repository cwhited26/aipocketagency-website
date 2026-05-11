import type { Metadata } from "next";
import Link from "next/link";

const PAGE_URL = "https://aipocketagency.com/dispatch-playbook/success";
const PAGE_TITLE = "You're in — The Dispatch Playbook | AI Pocket Agency";
const PAGE_DESCRIPTION =
  "Payment confirmed. Your Dispatch Playbook is being delivered to your inbox.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  robots: { index: false, follow: false },
};

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

const SKOOL_URL = "https://www.skool.com/aipocketagency";

export default function Page({
  searchParams,
}: {
  searchParams: { session_id?: string; email?: string };
}) {
  const email = searchParams?.email?.trim() || "";
  return (
    <main className="min-h-screen text-slate-100">
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-2xl px-6 pb-24 pt-24 sm:pt-32">
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
              style={{ fontFamily: MONO_FONT }}
            >
              [ paid · welcome ]
            </div>
            <h1 className="text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                You&apos;re in.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-slate-300 sm:text-xl">
              Your Dispatch Playbook is being delivered to{" "}
              {email ? (
                <span className="font-medium text-slate-100">{email}</span>
              ) : (
                <>the email you used at checkout</>
              )}
              . Check your inbox within the next few minutes. If you don&apos;t
              see it, check spam or reply to the receipt for help.
            </p>

            <div className="mt-10">
              <Link
                href={SKOOL_URL}
                className="group inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)]"
              >
                Join the APA community on Skool →
              </Link>
            </div>

            <p className="mt-8 text-sm text-slate-500">
              Want the whole brain pattern, not just the playbook?{" "}
              <Link
                href="/"
                className="text-accent underline-offset-4 transition hover:underline"
              >
                aipocketagency.com
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
