import Link from "next/link";
import WaitlistForm from "./WaitlistForm";
import type {
  WaitlistBundle,
  WaitlistModule,
  WaitlistModuleStatus,
} from "./waitlist-config";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

/**
 * Single landing component for the two "Coming Soon" bundle pages —
 * Capture Pack + Output Pack. Renders hero, the module catalog with
 * per-module status badges, the Hormozi-anchor pricing tease, and the
 * waitlist email-capture form.
 *
 * The status badges are the user-facing signal of which modules are
 * shipped. Flip a module's status from `coming-soon` → `live` in
 * `waitlist-config.ts` when it ships; the badge updates immediately,
 * no schema changes needed.
 */
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
      <FormSection
        label={bundle.formLabel}
        headline={bundle.formHeadline}
        subhead={bundle.formSubhead}
        cta={bundle.formCta}
        successLine={bundle.successLine}
        slug={bundle.slug}
      />
      <Footer />
    </main>
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
          <Link
            href="#waitlist"
            className="mt-10 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)]"
          >
            Get on the list
          </Link>
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
      <div className="flex flex-wrap items-start justify-between gap-3">
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
        <StatusBadge status={mod.status} />
      </div>
      <p className="mt-3 text-base leading-relaxed text-slate-300 sm:text-lg">
        {mod.blurb}
      </p>
      {mod.status === "live" && mod.liveHref ? (
        <div className="mt-4">
          <Link
            href={mod.liveHref}
            target={mod.liveHref.startsWith("http") ? "_blank" : undefined}
            rel={
              mod.liveHref.startsWith("http") ? "noopener noreferrer" : undefined
            }
            className="inline-flex items-center gap-2 rounded-full border border-accent/60 bg-accent/[0.06] px-4 py-2 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent/[0.12]"
          >
            {mod.liveCta || "Install"}
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="currentColor"
            >
              <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
            </svg>
          </Link>
        </div>
      ) : null}
    </li>
  );
}

function StatusBadge({ status }: { status: WaitlistModuleStatus }) {
  if (status === "live") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/[0.08] px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-emerald-300"
        style={{ fontFamily: MONO_FONT }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        [ live ]
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/40 bg-slate-500/[0.08] px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-400"
      style={{ fontFamily: MONO_FONT }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
      [ coming soon ]
    </span>
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

function FormSection({
  label,
  headline,
  subhead,
  cta,
  successLine,
  slug,
}: {
  label: string;
  headline: string;
  subhead: string;
  cta: string;
  successLine: string;
  slug: "capture-pack" | "output-pack";
}) {
  return (
    <section
      id="waitlist"
      className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-accent/5 via-transparent to-transparent scroll-mt-20"
    >
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto max-w-xl px-6 py-20 sm:py-24">
        <div className="text-center">
          <SectionLabel>{label}</SectionLabel>
          <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            {headline}
          </h2>
          <p className="mt-6 text-base leading-relaxed text-slate-300 sm:text-lg">
            {subhead}
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-md">
          <WaitlistForm
            waitlistFor={slug}
            cta={cta}
            successLine={successLine}
          />
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
          AI Pocket Agency · Built by an operator. Used by operators.{" "}
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
