import type { Metadata } from "next";
import StartForm from "./StartForm";

const PAGE_URL = "https://aipocketagency.com/start";
const DESCRIPTION =
  "Start your 14-day free trial of Pocket Agent. $97/mo after the trial. Cancel anytime.";

export const metadata: Metadata = {
  title: "Start your 14-day free trial — Pocket Agent",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Start your 14-day free trial — Pocket Agent",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Start your 14-day free trial — Pocket Agent",
    description: DESCRIPTION,
  },
};

export default function StartPage() {
  return <StartForm />;
}
