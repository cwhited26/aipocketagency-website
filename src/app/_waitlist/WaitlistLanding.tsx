import Link from "next/link";
import type { WaitlistBundle, WaitlistModule } from "./waitlist-config";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

export default function WaitlistLanding({ bundle }: { bundle: WaitlistBundle }) {
  return (
    <main className="min-h-screen text-slate-100">
      <Hero
        pill={bundle.heroPill}
        headline={bundle.heroHeadline}
        subhead={bundle.heroSubhead}
      />
      <Catalog
        label={bundle.catalogLabel}
        headline={bundle.catalogHeadline}
        intro={bundle.catalogIntro}
        modules={bundle.modules}
      />
      <Pricing
        label={bundle.pricingLabel}
        headline={bundle.pricingHeadline}
        paragraphs={bundle.pricingParagraphs}
      />
      <SubscribeCTA />
      <Footer />
    </main>
  );
}

function SubscribeCTA() {
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20 text-center">
        <div
          className="mb-4 text-xs text-cyan-300/70 sm:text-sm"
          style={{ fontFamily: MONO_FONT }}
        >
          [ pocket agent · $37/mo · 14-day free trial ]
        </div>
        <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
          All of this comes with Pocket Agent.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-slate-300">
          Sign up and every capability is active from day one — no separate
          purchase, no separate setup.
        </p>
        <div className="mt-8">
          <Link
            href="/start"
            className="inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg"
          >
            Start your 14-day free trial
            <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
              <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
      style={{ fontFamily: MONO_FONT }}
    >
      [ {children} ]
    </div>
  );
}

function Hero({
  pill,
  headline,
  subhead,
}: {
  pill: string;
  headline: string;
  subhead: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-20 sm:pt-28">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
            style={{ fontFamily: MONO_FONT }}
          >
            {pill}
          </div>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              {headline}
            </span>
          </h1>
          <p className="mt-6 text-balance text-lg text-slate-200 sm:text-xl">
            {subhead}
          </p>
          <div className="mt-10">
            <Link
              href="/start"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)]"
            >
              Start your 14-day free trial
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Catalog({
  label,
  headline,
  intro,
  modules,
}: {
  label: string;
  headline: string;
  intro: string;
  modules: WaitlistModule[];
}) {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>{label}</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {headline}
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-300">{intro}</p>
        <ul className="mt-10 space-y-4">
          {modules.map((m) => (
            <ModuleRow key={m.code} mod={m} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function ModuleRow({ mod }: { mod: WaitlistModule }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <div className="flex items-baseline gap-3">
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent"
          style={{ fontFamily: MONO_FONT }}
        >
          {mod.code}
        </span>
        <h3 className="text-lg font-semibold text-slate-100 sm:text-xl">
          {mod.title}
        </h3>
      </div>
      <p className="mt-3 text-base leading-relaxed text-slate-300 sm:text-lg">
        {mod.blurb}
      </p>
    </li>
  );
}

function Pricing({
  label,
  headline,
  paragraphs,
}: {
  label: string;
  headline: string;
  paragraphs: string[];
}) {
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-accent/[0.05] via-transparent to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>{label}</SectionLabel>
        <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          {headline}
        </h2>
        <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-black/40">
      <div className="mx-auto max-w-3xl px-6 py-12 text-center">
        <p className="text-sm leading-relaxed text-slate-400">
          Pocket Agent · Built by a builder. Run in the field.{" "}
          <Link href="/" className="text-accent transition hover:underline">
            Back to the homepage
          </Link>
          .
        </p>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-4 text-xs text-slate-600">
          © {new Date().getFullYear()} Whited Consulting. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
