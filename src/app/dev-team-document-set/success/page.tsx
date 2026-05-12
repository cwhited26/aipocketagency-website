import type { Metadata } from "next";
import KitSuccessPage from "@/app/_kit/KitSuccessPage";
import { getKitMeta } from "@/app/_kit/catalog";

const SLUG = "dev-team-document-set";

const kit = getKitMeta(SLUG);
const PAGE_URL = `https://aipocketagency.com/${SLUG}/success`;
const PAGE_TITLE = `You're in — ${kit.fullName} | AI Pocket Agency`;
const PAGE_DESCRIPTION = `Payment confirmed. Your ${kit.shortName} is being delivered to your inbox.`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  robots: { index: false, follow: false },
};

export default function Page({
  searchParams,
}: {
  searchParams: { session_id?: string; email?: string };
}) {
  const email = searchParams?.email?.trim() || "";
  return <KitSuccessPage slug={SLUG} email={email} />;
}
