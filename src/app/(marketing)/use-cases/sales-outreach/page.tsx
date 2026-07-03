import type { Metadata } from "next";
import { UseCasePlaceholder } from "@/components/marketing/use-case-placeholder";

const PAGE_URL = "https://aipocketagent.com/use-cases/sales-outreach";
const TITLE = "Sales Outreach with AI Agents — Pocket Agent";
const DESCRIPTION =
  "Every follow-up drafted in your voice and staged for one tap. Sweep runners, outreach composers, and pipeline reviewers — in the library today, ready to run.";

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

export default function SalesOutreachPage() {
  return <UseCasePlaceholder slug="sales-outreach" />;
}
