import type { Metadata } from "next";
import { notFound } from "next/navigation";
import KitSuccessPage from "@/app/_kit/KitSuccessPage";
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
  const pageUrl = `https://aipocketagent.com/${kit.slug}/success`;
  const title = `You're in — ${kit.fullName} | AI Pocket Agency`;
  const description = `Payment confirmed. Your ${kit.shortName} is being delivered to your inbox.`;
  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    robots: { index: false, follow: false },
  };
}

export default function Page({
  params,
  searchParams,
}: {
  params: { "kit-slug": string };
  searchParams: { session_id?: string; email?: string; bundled?: string };
}) {
  const slug = params["kit-slug"];
  if (!isKitSlug(slug)) {
    notFound();
  }
  const email = searchParams?.email?.trim() || "";
  const bundled = searchParams?.bundled === "1";
  return <KitSuccessPage slug={slug} email={email} bundled={bundled} />;
}
