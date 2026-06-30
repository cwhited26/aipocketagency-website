import type { Metadata } from "next";

const PAGE_URL = "https://start.aipocketagent.com";
const DESCRIPTION =
  "Pocket Agent is an AI workspace that knows your business — your voice, your customers, your prices, your processes — and actually does the work. 30 seconds, no credit card, instant access.";

export const metadata: Metadata = {
  title: "Build your AI office — Pocket Agent",
  description: DESCRIPTION,
  metadataBase: new URL(PAGE_URL),
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Your business. Finally has an agent.",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Your business. Finally has an agent.",
    description: DESCRIPTION,
  },
};

// Standalone funnel chrome. The root layout already supplies <html class="dark"> + the fonts;
// this just owns the funnel's background and width so no marketing nav/footer bleeds in.
export default function LaunchFunnelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-[#04070d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative">{children}</div>
    </div>
  );
}
