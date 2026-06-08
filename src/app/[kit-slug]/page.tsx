import type { Metadata } from "next";
import { notFound } from "next/navigation";
import KitLandingPage from "@/app/_kit/KitLandingPage";
import { KIT_SLUGS, getKitConfig, isKitSlug } from "@/lib/kit-config";

export const dynamicParams = false;

export function generateStaticParams() {
  return KIT_SLUGS.map((slug) => ({ "kit-slug": slug }));
}

export function generateMetadata({
  params,
}: {
  params: { "kit-slug": string };
}): Metadata {
  const slug = params["kit-slug"];
  const kit = getKitConfig(slug);
  if (!kit) return {};
  const pageUrl = `https://aipocketagent.com/${kit.slug}`;
  const title = `${kit.fullName} — $15 Instant Download | AI Pocket Agency`;
  const description = kit.blurb;
  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "AI Pocket Agency",
      type: "website",
      images: [
        {
          url: "https://aipocketagent.com/og-share.png",
          width: 1200,
          height: 630,
          alt: kit.ogAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["https://aipocketagent.com/og-share.png"],
    },
  };
}

export default function Page({
  params,
}: {
  params: { "kit-slug": string };
}) {
  const slug = params["kit-slug"];
  if (!isKitSlug(slug)) {
    notFound();
  }
  return <KitLandingPage slug={slug} />;
}
