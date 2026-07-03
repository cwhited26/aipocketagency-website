import type { Metadata } from "next";
import { UseCasePlaceholder } from "@/components/marketing/use-case-placeholder";

const PAGE_URL = "https://aipocketagent.com/use-cases/idea-to-mvp";
const TITLE = "Idea to MVP with AI Agents — Pocket Agent";
const DESCRIPTION =
  "Drop an idea. Approve the plan. Get a working product on accounts you own. The agents that do this work are in the library today, ready to run.";

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

export default function IdeaToMvpPage() {
  return <UseCasePlaceholder slug="idea-to-mvp" />;
}
