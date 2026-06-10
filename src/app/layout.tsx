import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
  title: "Pocket Agent — by AI Pocket Agency",
  description:
    "AI Pocket Agency — home of Pocket Agent. We give your business a memory. $37/mo, 14-day free trial.",
  metadataBase: new URL("https://aipocketagent.com"),
  openGraph: {
    title: "Pocket Agent — by AI Pocket Agency",
    description:
      "AI Pocket Agency — home of Pocket Agent. We give your business a memory. $37/mo, 14-day free trial.",
    url: "https://aipocketagent.com",
    siteName: "AI Pocket Agency",
    type: "website",
    images: [
      {
        url: "https://aipocketagent.com/og-share.png",
        width: 1200,
        height: 630,
        alt: "Pocket Agent — AI Pocket Agency",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pocket Agent — by AI Pocket Agency",
    description:
      "AI Pocket Agency — home of Pocket Agent. We give your business a memory. $37/mo, 14-day free trial.",
    images: ["https://aipocketagent.com/og-share.png"],
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
      <body className={`${inter.className} ${jetbrainsMono.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
