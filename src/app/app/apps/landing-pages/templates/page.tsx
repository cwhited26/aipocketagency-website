// /app/apps/landing-pages/templates — the Template Gallery (PA-TG-1..2, SPEC Phase 1).
//
// The motionsites-style picker over the brain's design-direction library: browse the catalog, filter
// by industry / vibe / use case, open a direction's detail, answer three questions, and PA fires the
// existing Landing Page Builder pipeline with the direction as the build input. Locked directions
// show with an upgrade chip (per-direction tier gating, PA-TG-2). Directions with a captured
// preview (PA-TG-3, the bos-template-mocks pipeline) render the real screenshot — plus the 4s
// animated demo at Studio+ — while the rest keep the styled placeholder from palette + typography.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, tierAllowsLandingPageBuilder, tierRank } from "@/lib/personas/tier-caps";
import {
  directionTierLabel,
  listDirections,
  loadableFamily,
  paletteRoles,
  tierAllowsDirection,
} from "@/lib/landing-pages/directions";
import { listTemplates } from "@/lib/landing-pages/templates";
import { getMoonchildConfig } from "@/lib/connectors/moonchild/client";
import { fetchMoonchildConnectionPublic } from "@/lib/pa-moonchild-connections";
import { fetchGithubBuildConnectionPublic } from "@/lib/pa-github-build-connections";
import { fetchVercelConnectionPublic } from "@/lib/pa-vercel-connections";
import { isGithubBuildOAuthConfigured } from "@/lib/connectors/github-build/oauth";
import { buildConnectorHref } from "@/lib/build-tools/onboarding";
import { redirect } from "next/navigation";
import Link from "next/link";
import TemplateGalleryClient, { type GalleryDirection } from "./TemplateGalleryClient";

export const dynamic = "force-dynamic";

export default async function TemplateGalleryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");
  const paUser = paResult.data;

  const [tier, moonchildConn, githubBuildConn, vercelConn] = await Promise.all([
    getCurrentTier(user.id),
    fetchMoonchildConnectionPublic(user.id),
    fetchGithubBuildConnectionPublic(user.id),
    fetchVercelConnectionPublic(user.id),
  ]);
  const canBuild = tierAllowsLandingPageBuilder(tier);
  // Build Tools pre-flight (PA-BUILDONBOARD-1): the Build button intercepts when GitHub or Vercel
  // isn't connected, so a page commits to the owner's own repo and deploys to their own URL.
  const githubOAuthConfigured = isGithubBuildOAuthConfigured();
  const buildTools = {
    githubConnected: (githubBuildConn.ok ? githubBuildConn.data?.status : null) === "active",
    vercelConnected: (vercelConn.ok ? vercelConn.data?.status : null) === "active",
    githubHref: buildConnectorHref("github_build", { githubOAuthConfigured }),
    vercelHref: buildConnectorHref("vercel", { githubOAuthConfigured }),
  };
  // Animated previews are the Studio+ unlock (SPEC Phase 2); below that the card shows the still.
  const animatedUnlocked = tierRank(tier) >= tierRank("studio_plus");
  const moonchildOwnerConnected =
    getMoonchildConfig().configured &&
    moonchildConn.ok &&
    moonchildConn.data !== null &&
    moonchildConn.data.status === "active" &&
    moonchildConn.data.hasToken;
  const now = new Date();

  const directions: GalleryDirection[] = listDirections().map((d) => {
    const roles = paletteRoles(d);
    return {
      slug: d.slug,
      name: d.name,
      vibe: d.vibe,
      industries: d.industries,
      useCases: d.useCases,
      locked: !tierAllowsDirection(tier, d),
      tierLabel: directionTierLabel(d.tierRequired),
      previewStatic: d.visualPreview.static,
      previewAnimated: animatedUnlocked ? d.visualPreview.animated : null,
      animatedReact: d.animatedReact ?? false,
      palette: d.colorPalette.slice(0, 4),
      previewBackground: roles.background,
      previewInk: roles.ink,
      previewAccent: roles.accent,
      displayFont: d.typography.display,
      bodyFont: d.typography.body,
      displayFamily: loadableFamily(d.typography.display),
      motifs: d.motifs,
      whenToUse: d.whenToUse,
      whenNotToUse: d.whenNotToUse,
      complexity: d.buildComplexity,
      featured: d.featured,
      isNew: d.newUntil !== null && new Date(d.newUntil) > now,
    };
  });

  // One stylesheet load covers every Google-loadable display family in the catalog, so each card's
  // typography preview is set in the direction's real face.
  const families = [...new Set(directions.map((d) => d.displayFamily).filter((f): f is string => f !== null))];
  const fontsHref =
    families.length > 0
      ? `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;700;800`).join("&")}&display=swap`
      : null;

  const quickStart = listTemplates().map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description,
    bestFor: t.bestFor,
  }));

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {fontsHref && <link rel="stylesheet" href={fontsHref} />}
        <div className="mb-2">
          <Link
            href="/app/apps/landing-pages"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Landing Page Builder
          </Link>
        </div>

        <div className="mb-8 max-w-2xl">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            The template gallery
          </div>
          <h1 className="text-2xl font-bold text-slate-100">
            Pick a template that doesn&apos;t look like everyone else&apos;s.
          </h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Each one is a different starting point — so your site stands out, not blends in. Pick the
            look that fits your business, answer three quick questions, and PA builds the page in your
            voice on your own accounts.
          </p>
        </div>

        <TemplateGalleryClient
          directions={directions}
          quickStart={quickStart}
          canBuild={canBuild}
          hasApiKey={Boolean(paUser.anthropic_api_key)}
          brainConnected={Boolean(paUser.brain_repo)}
          moonchildOwnerConnected={moonchildOwnerConnected}
          buildTools={buildTools}
        />
      </div>
    </div>
  );
}
