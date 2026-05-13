import type { Metadata } from "next";
import WaitlistLanding from "@/app/_waitlist/WaitlistLanding";
import { CAPTURE_PACK } from "@/app/_waitlist/waitlist-config";

const PAGE_URL = "https://aipocketagency.com/capture-pack";
const DESCRIPTION =
  "Tap once. The brain captures the rest. Five modules — voice, screenshot, share sheet, email, Loom — that turn your phone into a friction-free door into your AI Pocket Agency. Free waitlist while modules ship.";

export const metadata: Metadata = {
  title: "Capture Pack — Waitlist | AI Pocket Agency",
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
