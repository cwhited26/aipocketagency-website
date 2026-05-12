import type { Metadata } from "next";
import KitCheckoutPage from "@/app/_kit/KitCheckoutPage";
import { getKitMeta } from "@/app/_kit/catalog";

const SLUG = "dev-team-document-set";

const kit = getKitMeta(SLUG);
const PAGE_URL = `https://aipocketagency.com/${SLUG}/checkout`;
const PAGE_TITLE = `Checkout — ${kit.fullName} ($15) | AI Pocket Agency`;
const PAGE_DESCRIPTION =
  "Drop your info, pay $15, and the PDF lands in your inbox the moment Stripe confirms payment.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  robots: { index: false, follow: false },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
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

export default function Page({
  searchParams,
}: {
  searchParams: { cancelled?: string };
}) {
  const cancelled = searchParams?.cancelled === "1";
  return <KitCheckoutPage slug={SLUG} cancelled={cancelled} />;
}
