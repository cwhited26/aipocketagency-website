import type { MetadataRoute } from "next";
import { PERSONA_LINKS } from "@/data/marketing/persona-pages";
import { COMPARE_LINKS } from "@/data/marketing/compare-pages";
import { USE_CASE_LINKS } from "@/data/use-cases";

// The site had no sitemap before the Agents Library lane (PA-POS-24/25) — this route lists
// the public marketing surface. Registries drive the dynamic families so a new persona,
// compare, or use-case page lands here without another edit. Product routes under /app/*
// are auth-gated and stay out.
const BASE = "https://aipocketagent.com";

const STATIC_ROUTES = [
  "",
  "/pocket-agent",
  "/poc",
  "/why-pa",
  "/pricing",
  "/agents",
  "/templates",
  "/compare",
  "/about",
  "/start",
  "/enterprise",
  "/whatsapp",
  "/vs-twin",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    ...STATIC_ROUTES.map((path) => ({ url: `${BASE}${path}`, lastModified })),
    ...PERSONA_LINKS.map((p) => ({ url: `${BASE}/for/${p.slug}`, lastModified })),
    ...COMPARE_LINKS.map((c) => ({ url: `${BASE}/compare/${c.slug}`, lastModified })),
    ...USE_CASE_LINKS.map((u) => ({ url: `${BASE}/use-cases/${u.slug}`, lastModified })),
  ];
}
