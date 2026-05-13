import type { Metadata } from "next";
import WaitlistLanding from "@/app/_waitlist/WaitlistLanding";
import { OUTPUT_PACK } from "@/app/_waitlist/waitlist-config";

const PAGE_URL = "https://aipocketagency.com/output-pack";
const DESCRIPTION =
  "Your Pocket Agent works while you sleep. Eight ways — daily standup, pre-call brief, customer Q&A in your voice, compete-watch, content from past wins — that turn captured context into action. Decision Query is live now.";

export const metadata: Metadata = {
  title: "Output Pack — AI Pocket Agency",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Output Pack — AI Pocket Agency",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Output Pack — AI Pocket Agency",
    description: DESCRIPTION,
  },
};

export default function OutputPackPage() {
  return <WaitlistLanding bundle={OUTPUT_PACK} />;
}
