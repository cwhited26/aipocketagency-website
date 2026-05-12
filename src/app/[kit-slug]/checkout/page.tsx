import type { Metadata } from "next";
import { notFound } from "next/navigation";
import KitCheckoutPage from "@/app/_kit/KitCheckoutPage";
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
  const pageUrl = `https://aipocketagency.com/${kit.slug}/checkout`;
  const title = `Checkout — ${kit.fullName} ($15) | AI Pocket Agency`;
  const description =
    "Drop your info, pay $15, and the PDF lands in your inbox the moment Stripe confirms payment.";
  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "AI Pocket Agency",
      type: "website",
      images: [
        {
          url: "https://aipocketagency.com/og-share.png",
          width: 1200,
          height: 630,
          alt: kit.ogAlt,
        },
      ],
    },
  };
}

export default function Page({
  params,
  searchParams,
}: {
  params: { "kit-slug": string };
  searchParams: { cancelled?: string };
}) {
  const slug = params["kit-slug"];
  if (!isKitSlug(slug)) {
    notFound();
  }
  const cancelled = searchParams?.cancelled === "1";
  return <KitCheckoutPage slug={slug} cancelled={cancelled} />;
}
