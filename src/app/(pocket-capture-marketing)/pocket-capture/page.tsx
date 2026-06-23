import type { Metadata } from "next";
import { HERO } from "@/data/pocket-capture/marketing";
import { Hero } from "../_components/Hero";
import { PersonaSpray } from "../_components/PersonaSpray";
import { HowItWorks } from "../_components/HowItWorks";
import { Wedge } from "../_components/Wedge";
import { SocialProof } from "../_components/SocialProof";
import { Pricing } from "../_components/Pricing";
import { Faq } from "../_components/Faq";
import { PocketCaptureFooter } from "../_components/PocketCaptureFooter";

const DESCRIPTION =
  "Stop losing ideas. Speak them, share them, forward them, or text them — Pocket Capture saves whatever's worth remembering into a private feed only you can see. No app to download. $47 one-time.";

const SITE_URL = "https://capture.aipocketagent.com";

export const metadata: Metadata = {
  title: "Pocket Capture — stop losing ideas",
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: HERO.headline,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Pocket Capture",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: HERO.headline,
    description: DESCRIPTION,
  },
};

export default function PocketCaptureLanding() {
  return (
    <main className="text-slate-100">
      <Hero />
      <PersonaSpray />
      <HowItWorks />
      <Wedge />
      <SocialProof />
      <Pricing />
      <Faq />
      <PocketCaptureFooter />
    </main>
  );
}
