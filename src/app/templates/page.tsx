import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA, SecondaryCTA, MONO_FONT } from "@/components/marketing/cta";
import {
  directionTierLabel,
  listDirections,
  loadableFamily,
  paletteRoles,
} from "@/lib/landing-pages/directions";
import { DIRECTION_COUNTS } from "@/data/landing-page-templates/directions-meta";
import PublicGalleryClient, { type PublicDirection } from "./PublicGalleryClient";

// /templates — the public Template Gallery (Template Gallery prominence boost). The same catalog PA
// owners browse at /app/apps/landing-pages/templates, shown to prospects with no auth: every
// direction card with its real captured preview and the detail modal, but the build CTA becomes
// "Sign up to use." The catalog is static data, so the page prerenders.

const PAGE_URL = "https://aipocketagent.com/templates";
const DESCRIPTION = `${DIRECTION_COUNTS.total} distinct landing-page templates inside Pocket Agent. Each one is a different design direction — trades, med spa, real estate, luxury, SaaS, editorial — so your page stands out instead of blending in. Pick the look that fits your business and PA builds it in your voice on your own accounts.`;
const OG_TITLE = `${DIRECTION_COUNTS.total} distinct templates. Pick one your business actually fits.`;

export const metadata: Metadata = {
  title: `The Template Gallery — ${DIRECTION_COUNTS.total} distinct landing-page templates | Pocket Agent`,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: OG_TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: DESCRIPTION,
  },
};

export default function PublicTemplatesPage() {
  const directions: PublicDirection[] = listDirections().map((d) => {
    const roles = paletteRoles(d);
    return {
      slug: d.slug,
      name: d.name,
      vibe: d.vibe,
      industries: d.industries,
      useCases: d.useCases,
      // The plan badge a prospect sees on every card (PA-TG-11): starter-tier directions come with
      // every plan; the premium set names the plan that opens it.
      tierBadge:
        d.tierRequired === "starter"
          ? "Included in every plan"
          : `Included in ${directionTierLabel(d.tierRequired)}`,
      previewStatic: d.visualPreview.static,
      previewAnimated: d.visualPreview.animated,
      animatedReact: d.animatedReact ?? false,
      palette: d.colorPalette.slice(0, 4),
      previewBackground: roles.background,
      previewInk: roles.ink,
      previewAccent: roles.accent,
      displayFont: d.typography.display,
      bodyFont: d.typography.body,
      displayFamily: loadableFamily(d.typography.display),
      motifs: d.motifs,
      whenToUse: d.whenToUse,
      whenNotToUse: d.whenNotToUse,
      complexity: d.buildComplexity,
      featured: d.featured,
    };
  });

  // One stylesheet load covers every Google-loadable display family in the catalog, the same way
  // the in-app gallery does it, so each card's typography preview is set in the direction's real face.
  const families = [...new Set(directions.map((d) => d.displayFamily).filter((f): f is string => f !== null))];
  const fontsHref =
    families.length > 0
      ? `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;700;800`).join("&")}&display=swap`
      : null;

  return (
    <main className="min-h-screen text-slate-100">
      {fontsHref && <link rel="stylesheet" href={fontsHref} />}
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-25" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-24 text-center sm:pt-28">
          <div className="mb-5 inline-block text-xs text-cyan-300/70" style={{ fontFamily: MONO_FONT }}>
            [ the template gallery · inside the Landing Page Builder ]
          </div>
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {DIRECTION_COUNTS.total} distinct templates. Pick one your business actually fits.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-slate-300">
            Most AI-built pages look like the same page wearing different logos. Every template here
            is a different design direction — a phone-first trades page, a booking-led med spa, a
            luxury listing site, a deep-shadow SaaS — so your page stands out instead of blending in.
            You pick the look, PA writes it in your voice and builds it on your own accounts.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PrimaryCTA href="/start" label="Start with Pocket Agent" />
            <SecondaryCTA href="/pricing" label="See pricing" />
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <PublicGalleryClient directions={directions} />
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
          <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            Start with Pocket Agent — the Template Gallery is built in from day one.
          </h2>
          <p className="mt-5 max-w-xl text-balance text-lg leading-relaxed text-slate-300">
            {DIRECTION_COUNTS.starter} templates are included with every plan, and the{" "}
            {DIRECTION_COUNTS.studioPlus} premium looks open at Studio+. Pick yours, answer three
            quick questions, and PA builds the page in your voice.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <PrimaryCTA href="/start" label="Build My AI Team" />
            <Link
              href="/pricing"
              className="text-sm text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
            >
              Or compare the plans
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
