import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Pocket Agency — Run an AI agency from your pocket",
  description:
    "Get the AI brain that makes it possible — the system Chase Whited uses to run real software businesses from anywhere, with any agent. Founding 50 only. $47/mo locked for life.",
  metadataBase: new URL("https://aipocketagency.com"),
  openGraph: {
    title: "AI Pocket Agency — Run an AI agency from your pocket",
    description:
      "The AI brain that lets you run real software businesses from anywhere, with any agent. Founding 50 — $47/mo locked for life.",
    url: "https://aipocketagency.com",
    siteName: "AI Pocket Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Pocket Agency — Run an AI agency from your pocket",
    description:
      "The AI brain that lets you run real software businesses from anywhere, with any agent.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
