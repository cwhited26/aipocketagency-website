import type { Metadata } from "next";
import WaitlistLanding from "@/app/_waitlist/WaitlistLanding";
import { CAPTURE_PACK } from "@/app/_waitlist/waitlist-config";

const PAGE_URL = "https://aipocketagency.com/capture-pack";
const DESCRIPTION =
  "Tap once. Your AI captures the rest. Five ways — voice, screenshot, share sheet, email, Loom — that turn your phone into a friction-free door into your Pocket Agent. All five included with Pocket Agent.";

export const metadata: Metadata = {
  title: "Capture Pack — AI Pocket Agency",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Capture Pack — AI Pocket Agency",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Capture Pack — AI Pocket Agency",
    description: DESCRIPTION,
  },
};

export default function CapturePackPage() {
  return <WaitlistLanding bundle={CAPTURE_PACK} />;
}
