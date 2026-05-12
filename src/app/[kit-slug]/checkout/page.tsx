import { permanentRedirect } from "next/navigation";
import { KIT_SLUGS, isKitSlug } from "@/lib/kit-config";

export const dynamicParams = false;

export function generateStaticParams() {
  return KIT_SLUGS.map((slug) => ({ "kit-slug": slug }));
}

/**
 * Backward-compat redirect. The old `/[kit-slug]/checkout` route was the
 * separate "drop your info" page. The flow is now inline on the landing
 * page (`/[kit-slug]`), and the form scrolls into view via #form anchor.
 *
 * Drip emails, social posts, and any pre-existing /checkout links all
 * land on the landing page form section instead of 404.
 */
export default function Page({ params }: { params: { "kit-slug": string } }) {
  const slug = params["kit-slug"];
  if (!isKitSlug(slug)) {
    permanentRedirect("/");
  }
  permanentRedirect(`/${slug}#form`);
}
