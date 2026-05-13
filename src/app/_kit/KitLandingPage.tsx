import Image from "next/image";
import Link from "next/link";
import CheckoutForm from "./CheckoutForm";
import {
  BUNDLE_PUBLIC_USD,
  KIT_CONFIG,
  KIT_RETAIL_USD,
  KIT_SLUGS,
  getKitConfig,
  type KitMarketingContent,
  type KitSlug,
} from "@/lib/kit-config";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

/**
 * Single landing component for every $15 kit. Hero + image + form sit
 * inline (no separate /checkout hop). When `marketingContent` is populated
 * on the kit (e.g. Dispatch Playbook), the long-form problem / what's
 * inside / deal sections render beneath the form. Other kits get the bare
 * hero + form treatment until their marketing content is written.
 *
 * After form submit the buyer goes to /[kit-slug]/upgrade-pair/<lead_id>
 * (the order-bump interstitial) — Stripe is NOT opened from this page.
 */
export default function KitLandingPage({ slug }: { slug: KitSlug }) {
  const kit = getKitConfig(slug);
  if (!kit) {
    throw new Error(`KitLandingPage rendered with unknown slug: ${slug}`);
  }
  const content = kit.marketingContent;

  return (
    <main className="min-h-screen text-slate-100">
      <Hero
        fullName={kit.fullName}
        ogAlt={kit.ogAlt}
        slug={kit.slug}
        pill={content?.heroPill ?? "[ $15 · instant download ]"}
        subhead={content?.heroSubhead ?? kit.blurb}
        showHeroImage={kit.heroAvailable}
      />
      {content ? <Problem content={content} /> : null}
      {content ? <WhatsInside content={content} /> : null}
      <BundleCTA currentSlug={kit.slug} />
      <RelatedKits currentSlug={kit.slug} />
      <BrainStackCTA />
      <FormSection
        slug={kit.slug}
        dealHeadline={content?.dealHeadline ?? null}
        dealParagraphs={content?.dealParagraphs ?? null}
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
  fullName,
  ogAlt,
  slug,
  pill,
  subhead,
  showHeroImage,
}: {
  fullName: string;
  ogAlt: string;
  slug: KitSlug;
  pill: string;
  subhead: string;
  showHeroImage: boolean;
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
              {fullName}
            </span>
          </h1>
          <p className="mt-6 text-balance text-lg text-slate-200 sm:text-xl">
            {subhead}
          </p>
          {showHeroImage ? (
            <div className="mt-10 w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
              <Image
                src={`/funnel-images/${slug}-hero.png`}
                alt={ogAlt}
                width={1200}
                height={800}
                priority
                className="block w-full h-auto"
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Problem({ content }: { content: KitMarketingContent }) {
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-accent/[0.05] via-transparent to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>the problem</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {content.problemHeadline}
        </h2>
        <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
          {content.problemParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhatsInside({ content }: { content: KitMarketingContent }) {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>what&apos;s inside</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {content.whatsInsideHeadline}
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-300">
          {content.whatsInsideIntro}
        </p>
        <ol className="mt-8 space-y-3">
          {content.whatsInsideItems.map((s) => (
            <li
              key={s.n}
              className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"
            >
              <span
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
                style={{ fontFamily: MONO_FONT }}
              >
                {s.n}
              </span>
              <span className="text-base leading-relaxed text-slate-200 sm:text-lg">
                {s.title}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-lg leading-relaxed text-slate-300">
          {content.whatsInsideOutro}
        </p>
      </div>
    </section>
  );
}

function FormSection({
  slug,
  dealHeadline,
  dealParagraphs,
}: {
  slug: KitSlug;
  dealHeadline: string | null;
  dealParagraphs: string[] | null;
}) {
  return (
    <section
      id="form"
      className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-accent/5 via-transparent to-transparent scroll-mt-20"
    >
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto max-w-xl px-6 py-20 sm:py-24">
        <div className="text-center">
          <SectionLabel>the deal</SectionLabel>
          {dealHeadline ? (
            <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              {dealHeadline}
            </h2>
          ) : (
            <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              $15. Instant download. Two short questions, then payment.
            </h2>
          )}
          {dealParagraphs ? (
            <div className="mt-6 space-y-5 text-base leading-relaxed text-slate-300 sm:text-lg">
              {dealParagraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mx-auto mt-10 max-w-md">
          <CheckoutForm source={slug} />
        </div>
      </div>
    </section>
  );
}

function BundleCTA({ currentSlug }: { currentSlug: KitSlug }) {
  const individualTotalUsd = KIT_SLUGS.length * KIT_RETAIL_USD;
  const savingUsd = individualTotalUsd - BUNDLE_PUBLIC_USD;
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-indigo-500/[0.06] via-transparent to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <SectionLabel>the bundle</SectionLabel>
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Want all five? Bundle for ${BUNDLE_PUBLIC_USD} — save ${savingUsd}{" "}
          against ${individualTotalUsd} buying them separately.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-slate-300">
          Five $15 kits = ${individualTotalUsd}. The full operator stack —
          Dispatch, Dev-Team Document Set, CLAUDE.md Template Library,
          Discovery → MVP Prompt Pack, Wire-the-Brain-to-Stack — bundled
          once at ${BUNDLE_PUBLIC_USD}.
        </p>
        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Link
            href={`/bundle?from=${currentSlug}`}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-base"
          >
            <span>Get the bundle — ${BUNDLE_PUBLIC_USD}</span>
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="currentColor"
            >
              <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
            </svg>
          </Link>
          <div className="text-xs text-slate-500" style={{ fontFamily: MONO_FONT }}>
            [ ${BUNDLE_PUBLIC_USD} vs ${individualTotalUsd} separately ·
            save ${savingUsd} ]
          </div>
        </div>
      </div>
    </section>
  );
}

function RelatedKits({ currentSlug }: { currentSlug: KitSlug }) {
  const others = KIT_SLUGS.map((s) => KIT_CONFIG[s]).filter(
    (k) => k.slug !== currentSlug,
  );
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <SectionLabel>the other kits</SectionLabel>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          The rest of the stack.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-slate-300">
          Each kit is ${KIT_RETAIL_USD}. Same shape, same instant download,
          same refund-on-reply guarantee.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {others.map((k) => (
            <li key={k.slug}>
              <Link
                href={`/${k.slug}`}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-accent/40 hover:bg-white/[0.04] sm:p-6"
              >
                <div
                  className="text-xs text-cyan-300/70"
                  style={{ fontFamily: MONO_FONT }}
                >
                  [ ${KIT_RETAIL_USD} · instant download ]
                </div>
                <div className="text-lg font-semibold leading-tight text-slate-100 sm:text-xl">
                  {k.fullName}
                </div>
                <p className="text-sm leading-relaxed text-slate-400 sm:text-base">
                  {k.blurb}
                </p>
                <div className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-accent transition group-hover:gap-2">
                  Get it for ${KIT_RETAIL_USD}
                  <svg
                    aria-hidden
                    viewBox="0 0 20 20"
                    className="h-4 w-4"
                    fill="currentColor"
                  >
                    <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function BrainStackCTA() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <SectionLabel>the rest of the stack</SectionLabel>
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          While you&apos;re here — the rest of the brain stack is in motion.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-300">
          This kit is one piece. Two more layers — Capture (how thoughts get
          into the brain) and Output (what the brain does on its own) — are
          mapped, in motion, and shipping module by module. Catalog is public
          today so you can see what&apos;s coming before it lands.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <BrainStackCard
            pill="[ capture pack ]"
            title="Tap once. The brain captures the rest."
            detail="5 modules — voice, screenshot, share sheet, email, Loom. C3 LIVE. 4 coming."
            href="/capture-pack"
          />
          <BrainStackCard
            pill="[ output pack ]"
            title="Your brain works while you sleep."
            detail="8 modules — standup, pre-call brief, customer Q&A in your voice, compete-watch, content from past wins. All coming."
            href="/output-pack"
          />
        </div>
      </div>
    </section>
  );
}

function BrainStackCard({
  pill,
  title,
  detail,
  href,
}: {
  pill: string;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-accent/40 hover:bg-white/[0.04] sm:p-7"
    >
      <div
        className="text-xs text-cyan-300/70 sm:text-sm"
        style={{ fontFamily: MONO_FONT }}
      >
        {pill}
      </div>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">
        {title}
      </h3>
      <p className="mt-3 text-base leading-relaxed text-slate-300">{detail}</p>
      <div
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent transition group-hover:translate-x-0.5"
        style={{ fontFamily: MONO_FONT }}
      >
        See the catalog →
      </div>
    </Link>
  );
}

function Footer() {
  return (
    <footer className="bg-black/40">
      <div className="mx-auto max-w-3xl px-6 py-12 text-center">
        <p className="text-sm leading-relaxed text-slate-400">
          Delivered as PDF + markdown to the email used at checkout. If it
          doesn&apos;t land within minutes, full refund — just reply to the
          receipt.
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
