import type { Metadata } from "next";
import { UseCasePlaceholder } from "@/components/marketing/use-case-placeholder";

const PAGE_URL = "https://aipocketagent.com/use-cases/content-creation";
const TITLE = "Content Creation with AI Agents — Pocket Agent";
const DESCRIPTION =
  "Newsletters, posts, and pages drafted from what your business already knows — in your voice, staged for your review. The agents that do this work are in the library today, ready to run.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function ContentCreationPage() {
  return <UseCasePlaceholder slug="content-creation" />;
}
