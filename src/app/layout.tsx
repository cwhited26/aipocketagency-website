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
  title: "Pocket Agent — The AI brain for your business | AI Pocket Agency",
  description:
    "Your AI keeps forgetting everything you tell it. Pocket Agent gives it a brain — persistent memory wired to your GitHub, available to every agent you run. Drafts emails, moves leads, writes estimates. $97/mo, 14-day free trial.",
  metadataBase: new URL("https://aipocketagency.com"),
  openGraph: {
    title: "Pocket Agent — Your AI finally has a brain",
    description:
      "Connect your GitHub and every decision you've made is available to every agent you run. Drafts emails, moves leads, writes estimates in your voice. $97/mo, 14-day free trial.",
    url: "https://aipocketagency.com",
    siteName: "AI Pocket Agency",
    type: "website",
    images: [
      {
        url: "https://aipocketagency.com/og-share.png",
        width: 1200,
        height: 630,
        alt: "Pocket Agent — AI Pocket Agency",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pocket Agent — Your AI finally has a brain",
    description:
      "Your AI keeps forgetting everything. Pocket Agent gives it a brain — persistent memory, available to every agent you run. $97/mo, 14-day free trial.",
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
