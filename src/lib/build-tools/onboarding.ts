// onboarding.ts — tier-aware Build Tools onboarding (PA-BUILDONBOARD-1).
//
// One source of truth for the value-first Build Tools connect copy and for which connectors a tier
// needs. Studio+ owners sign up to BUILD on the platform: the code commits to their GitHub, the page
// deploys to their Vercel, the database runs on their Supabase. This module drives three surfaces —
// the Launch Kit items, the Apps-grid card pre-flight, and the Build-button intercept modal — so the
// framing is one thing in one place. Pure data + pure functions, no I/O.

import {
  tierAllowsLandingPageBuilder,
  tierAllowsIdeaEngineAutoBuild,
  type Tier,
} from "@/lib/personas/tier-caps";

export type BuildConnectorId = "github_build" | "vercel" | "supabase";

/** Where the paste-token connectors are managed (and the GitHub fallback when OAuth isn't configured). */
export const CONNECTIONS_HREF = "/app/settings/connections";
/** GitHub Build is the one connector with a real one-click OAuth start endpoint. */
const GITHUB_BUILD_OAUTH_START = "/api/connectors/github-build/start";

export type BuildConnectorCopy = {
  id: BuildConnectorId;
  /** Short name for buttons and pills. */
  name: string;
  /** Launch Kit item title — declarative, the why before the how. */
  launchKitTitle: string;
  /** Launch Kit one-liner. */
  launchKitBlurb: string;
  /** Button label — friction-low. */
  buttonLabel: string;
};

// The canonical Build Tools copy. Every customer-facing string for this feature lives here so the
// voice check happens in one file (chase-spec §10: own-it framing, no "you need to", no padding).
export const BUILD_CONNECTORS: Record<BuildConnectorId, BuildConnectorCopy> = {
  github_build: {
    id: "github_build",
    name: "GitHub",
    launchKitTitle: "Connect your GitHub so the code lives in your repo.",
    launchKitBlurb:
      "When Pocket Agent builds a page or an MVP, the code commits to YOUR GitHub. Not ours. That's the whole point.",
    buttonLabel: "Connect GitHub (30 seconds)",
  },
  vercel: {
    id: "vercel",
    name: "Vercel",
    launchKitTitle: "Connect your Vercel so everything we build deploys to your URL.",
    launchKitBlurb:
      "Your landing pages go live at <your-slug>.vercel.app under your Vercel account. You own the analytics, the bandwidth, the custom domain. Free Vercel tier is fine.",
    buttonLabel: "Connect Vercel (30 seconds)",
  },
  supabase: {
    id: "supabase",
    name: "Supabase",
    launchKitTitle:
      "Connect your Supabase so the Idea Engine can include a database when your MVP needs one.",
    launchKitBlurb:
      "Studio+ unlocks the full Idea Engine: drop an idea → seven approval gates → a working MVP with auth + database, all on YOUR Supabase. Skip this if you only want static pages.",
    buttonLabel: "Connect Supabase (60 seconds)",
  },
};

/**
 * Resolve where a connect button goes. GitHub Build has a real one-click OAuth start; Vercel and
 * Supabase connect by pasting a token on the Connections page, and GitHub falls back there too when
 * its OAuth app isn't configured for this deployment.
 */
export function buildConnectorHref(
  id: BuildConnectorId,
  opts: { githubOAuthConfigured: boolean },
): string {
  if (id === "github_build" && opts.githubOAuthConfigured) return GITHUB_BUILD_OAUTH_START;
  return CONNECTIONS_HREF;
}

/** Does this tier build on the platform at all — landing pages, or auto-build MVPs? */
export function tierBuildsOnPlatform(tier: Tier): boolean {
  return tierAllowsLandingPageBuilder(tier) || tierAllowsIdeaEngineAutoBuild(tier);
}

/**
 * The connectors a tier needs to ship what it builds. GitHub + Vercel for anything (a page or an
 * MVP); Supabase only when the tier unlocks auto-build (the full Idea Engine with a database).
 */
export function requiredBuildConnectors(tier: Tier): BuildConnectorId[] {
  const ids: BuildConnectorId[] = [];
  if (tierBuildsOnPlatform(tier)) ids.push("github_build", "vercel");
  if (tierAllowsIdeaEngineAutoBuild(tier)) ids.push("supabase");
  return ids;
}

export type BuildConnectionState = Record<BuildConnectorId, boolean>;

export type LaunchKitConnectItem = {
  id: BuildConnectorId;
  title: string;
  blurb: string;
  buttonLabel: string;
  href: string;
  connected: boolean;
};

/** The tier-aware Build Tools items for the Launch Kit, with live connected state folded in. */
export function launchKitConnectItems(input: {
  tier: Tier;
  connected: BuildConnectionState;
  githubOAuthConfigured: boolean;
}): LaunchKitConnectItem[] {
  return requiredBuildConnectors(input.tier).map((id) => {
    const copy = BUILD_CONNECTORS[id];
    return {
      id,
      title: copy.launchKitTitle,
      blurb: copy.launchKitBlurb,
      buttonLabel: copy.buttonLabel,
      href: buildConnectorHref(id, { githubOAuthConfigured: input.githubOAuthConfigured }),
      connected: input.connected[id],
    };
  });
}

export type PreflightConnector = {
  id: BuildConnectorId;
  name: string;
  buttonLabel: string;
  href: string;
};

/** The connect buttons a pre-flight modal shows — only the connectors still missing. */
export function missingBuildConnectors(input: {
  ids: BuildConnectorId[];
  connected: BuildConnectionState;
  githubOAuthConfigured: boolean;
}): PreflightConnector[] {
  return input.ids
    .filter((id) => !input.connected[id])
    .map((id) => ({
      id,
      name: BUILD_CONNECTORS[id].name,
      buttonLabel: `Connect ${BUILD_CONNECTORS[id].name} →`,
      href: buildConnectorHref(id, { githubOAuthConfigured: input.githubOAuthConfigured }),
    }));
}

/** Count the connectors a tier needs that aren't connected yet. */
export function missingBuildConnectorCount(tier: Tier, connected: BuildConnectionState): number {
  return requiredBuildConnectors(tier).filter((id) => !connected[id]).length;
}

/** The Apps-grid pill, pluralized. */
export function connectPillLabel(missingCount: number): string {
  return missingCount === 1 ? "Connect 1 thing to use →" : `Connect ${missingCount} things to use →`;
}

// The value stacks for the pre-flight modal — what the owner walks away owning, declared plainly.
export const PAGE_VALUE_STACK: readonly string[] = [
  "Your code commits to your GitHub. Every file Pocket Agent writes lands in a repo you own.",
  "Your page goes live on your Vercel URL. You own the analytics, the bandwidth, the traffic.",
  "Your custom domain attaches whenever you're ready. Point it at the page and it's yours.",
];

export const MVP_VALUE_STACK: readonly string[] = [
  "Your code commits to your GitHub. Every file Pocket Agent writes lands in a repo you own.",
  "Your MVP deploys to your Vercel URL. You own the analytics, the bandwidth, the traffic.",
  "Your database runs on your Supabase. Auth and data sit on an account you control.",
];
