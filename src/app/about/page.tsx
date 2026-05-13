import type { Metadata } from "next";
import Link from "next/link";

const PAGE_URL = "https://aipocketagency.com/about";
const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

export const metadata: Metadata = {
  title: "About — AI Pocket Agency",
  description:
    "AI Pocket Agency is the studio behind Pocket Agent, the $15 operator kits, and the Skool community where we build it all in public.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "About — AI Pocket Agency",
    description:
      "AI Pocket Agency is the studio behind Pocket Agent, the $15 operator kits, and the Skool community where we build it all in public.",
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen text-slate-100">
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-6 pb-24 pt-20 sm:pt-28">
          <div
            className="mb-4 text-xs text-cyan-300/70 sm:text-sm"
            style={{ fontFamily: MONO_FONT }}
          >
            [ ai pocket agency ]
          </div>
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            AI Pocket Agency
          </h1>
          <p className="mt-6 text-balance text-xl leading-relaxed text-slate-200 sm:text-2xl">
            AI Pocket Agency is the studio behind Pocket Agent, the $15
            operator kits, and the Skool community where we build it all in
            public. We give your business a memory that doesn&apos;t reset
            every chat.
          </p>
        </div>
      </section>

      <section className="border-b border-white/5 bg-black/30">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <div className="space-y-10 text-lg leading-relaxed text-slate-300">
            <div>
              <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">
                What we are
              </h2>
              <p className="mt-4">
                A studio — not an agency in the done-for-you sense. We ship
                products: Pocket Agent (the SaaS), the operator kits (the $15
                frameworks you can run yourself), and the Skool community
                (live builds with Chase, three times a week). Each one is
                complete on its own. Together they cover the full stack for
                running a business on AI.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">
                Why we built this
              </h2>
              <p className="mt-4">
                Chase runs three businesses on the brain pattern that became
                Pocket Agent. Not as a demo. Not as a prototype. As the actual
                system he uses to manage clients, ship software, and run
                operations from a phone between job sites. Everything we sell
                is something we&apos;ve already proven on our own operations
                before we charge anyone else for it. That&apos;s not a
                marketing line — it&apos;s why the kits are specific and the
                Pocket Agent onboarding is fast. We know exactly where it gets
                hard.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">
                Where we&apos;re going
              </h2>
              <p className="mt-4">
                More kits. More capabilities inside Pocket Agent. More live
                builds in public. The pattern scales — the only constraint is
                proving each piece in the field before we ship it.
              </p>
            </div>
          </div>

          <div className="mt-16">
            <Link
              href="/start"
              className="inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg"
            >
              Start your 14-day Pocket Agent trial
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="h-5 w-5"
                fill="currentColor"
              >
                <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-black/40">
        <div className="mx-auto max-w-5xl px-6 py-4 text-xs text-slate-600">
          © {new Date().getFullYear()} Whited Consulting. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
