import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#22d3ee",
};

export const metadata: Metadata = {
  title: "Pocket Agent — the AI Agent Workspace for owner-led businesses",
  description:
    "Pocket Agent gives your business a memory — the AI Agent Workspace that starts from your business, not a blank box. $37/mo, 14-day free trial.",
  metadataBase: new URL("https://aipocketagent.com"),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Pocket Agent",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Pocket Agent — the AI Agent Workspace for owner-led businesses",
    description:
      "Pocket Agent gives your business a memory — the AI Agent Workspace that starts from your business, not a blank box. $37/mo, 14-day free trial.",
    url: "https://aipocketagent.com",
    siteName: "Pocket Agent",
    type: "website",
    images: [
      {
        url: "https://aipocketagent.com/og-share.png",
        width: 1200,
        height: 630,
        alt: "Pocket Agent — the AI Agent Workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pocket Agent — the AI Agent Workspace for owner-led businesses",
    description:
      "Pocket Agent gives your business a memory — the AI Agent Workspace that starts from your business, not a blank box. $37/mo, 14-day free trial.",
    images: ["https://aipocketagent.com/og-share.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
