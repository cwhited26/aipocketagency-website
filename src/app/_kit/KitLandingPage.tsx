import Image from "next/image";
import CheckoutForm from "./CheckoutForm";
import {
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
