import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Pocket Agency — Run an AI agency from your pocket",
  description:
    "Vibe-coding a real SaaS and your agent's context keeps filling up? The AI brain solves it — persistent file-based memory + multi-lane agents so you can build large or parallel apps without hitting the wall. Founding 50 — $47/mo locked for life.",
  metadataBase: new URL("https://aipocketagency.com"),
  openGraph: {
    title: "AI Pocket Agency — Built for the wall you just hit",
    description:
      "Your agent's context fills up at 40k tokens. The AI brain doesn't — because it lives in files. Build large SaaS apps or run many in parallel without losing memory. Founding 50 — $47/mo locked for life.",
    url: "https://aipocketagency.com",
    siteName: "AI Pocket Agency",
    type: "website",
    images: [
      {
        url: "https://aipocketagency.com/og-share.png",
        width: 1200,
        height: 630,
        alt: "AI Pocket Agency — Run an AI agency from your pocket",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Pocket Agency — Built for the wall you just hit",
    description:
      "Your agent's context fills up at 40k tokens. The AI brain doesn't — because it lives in files. File-based memory + multi-lane agents for builders who refuse to start over.",
    images: ["https://aipocketagency.com/og-share.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} ${jetbrainsMono.variable}`}>{children}</body>
    </html>
  );
}
