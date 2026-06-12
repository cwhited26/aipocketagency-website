import Image from "next/image";
import Link from "next/link";
import { DIRECTION_COUNTS } from "@/data/landing-page-templates/directions-meta";

// The Template Gallery dashboard tile (Template Gallery prominence boost). The gallery shipped at
// /app/apps/landing-pages/templates but was only reachable through the Landing Page Builder App —
// most owners never found it. This tile puts it above the fold on the post-login dashboard with a
// small strip of real captured previews cycling through different aesthetics.

// Five of the captured directions, picked to show how differently the templates read — a phone-first
// trades page, a booking-led med spa, a gray-panel agency, a deep-shadow SaaS, a glassmorphism look.
const PREVIEW_STRIP: { slug: string; alt: string }[] = [
  { slug: "trades-phone-first-emergency", alt: "Trades template preview" },
  { slug: "medspa-booking-calendar-first", alt: "Med spa template preview" },
  { slug: "cognitra-ai-agency-gray-panel", alt: "Cognitra template preview" },
  { slug: "bookedup-deep-shadow-saas", alt: "BookedUp template preview" },
  { slug: "glassmorphism-purple-pink-agency", alt: "Glassmorphism template preview" },
];

export function TemplateGalleryTile() {
  return (
    <Link
      href="/app/apps/landing-pages/templates"
      className="group block rounded-xl border border-slate-800/70 bg-slate-950/50 transition-colors hover:border-[#22d3ee]/40"
    >
      <div className="grid grid-cols-3 gap-1.5 p-3 pb-0 sm:grid-cols-5">
        {PREVIEW_STRIP.map((p, i) => (
          <div
            key={p.slug}
            className={`relative overflow-hidden rounded-lg border border-slate-800/60 ${
              i >= 3 ? "hidden sm:block" : ""
            }`}
            style={{ aspectRatio: "16 / 9" }}
          >
            <Image
              src={`/templates/${p.slug}.png`}
              alt={p.alt}
              fill
              sizes="(max-width: 640px) 33vw, 160px"
              className="object-cover object-top"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">
            {DIRECTION_COUNTS.total} distinct templates. Pick one your business actually fits.
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
            Every one is a different design direction — so your page doesn&apos;t read as another
            AI-built template. You pick the look, PA builds it in your voice.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#22d3ee] px-4 py-1.5 text-[12px] font-semibold text-[#06121a] transition-colors group-hover:bg-[#22d3ee]/90">
          Browse the Gallery →
        </span>
      </div>
    </Link>
  );
}
