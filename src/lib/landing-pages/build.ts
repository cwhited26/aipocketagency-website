// build.ts — the Landing Page Builder orchestrator (PA-LPB-1). It turns a template + the generated
// copy into a deployable Next.js project, then drives the build through the shipped Build Tools as a
// sequence of approval-gated steps: create the GitHub repo → push the files → create the Vercel
// project → deploy → return the URL.
//
// Two surfaces share one plan:
//   • runLandingPageBuild(runner) — the pure orchestrator loop. It runs each planned step through an
//     injected step runner, threads each step's output into the next, and FAIL-STOPS at the first
//     non-executed step (a rejection ends the build). The integration test drives it with a mock
//     GitHub + Vercel pair; an auto-approve path could drive it inline.
//   • stagePlanFor(cursor, page) — the production stager input: the connector + action + payload for
//     the single step a given build cursor needs, staged for approval one at a time (lib/landing-pages/
//     advance.ts). The owner approves each card; the existing connector executors do the real work.
//
// Code generation is a real, metered Anthropic call (PA-LPB-3) with a deterministic template fill as
// the guaranteed fallback — so a model hiccup degrades to a clean page, never a broken build.

import { logCostFromUsage, type CostContext } from "@/lib/cost/log";
import { COPY_PLACEHOLDER } from "./templates";
import { scopeLabel } from "./scope";
import type { BuildStep, DesignSystemSnapshot, GeneratedBundle, GeneratedCopy, LandingPageRow, LandingTemplate } from "./types";

const CODE_MODEL = "claude-sonnet-4-6";

// ── Slug + deterministic project fill ───────────────────────────────────────────────────────────

/**
 * A stable, lowercase, GitHub/Vercel-safe slug for a page. Derived from the title plus a short id
 * suffix so two pages with the same title don't collide on the owner's account. Matches both the
 * GitHub repo-name regex and the Vercel project-name regex (lowercase letters, digits, '-').
 */
export function landingSlug(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  const suffix = id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase();
  return `${base || "landing-page"}-${suffix || "page"}`;
}

/** Deterministically fill a template's component skeleton with the generated copy (copy as data). */
export function fillTemplate(template: LandingTemplate, copy: GeneratedCopy): string {
  return template.componentTemplate.split(COPY_PLACEHOLDER).join(JSON.stringify(copy, null, 2));
}

/**
 * The static Next.js project files every generated landing page ships with (deployable as-is).
 * `scope` is the pa_landing_pages.brain_scope value, used to write the README provenance line
 * (PA-LPB-8) so the code carries the audit trail.
 */
export function scaffoldFiles(title: string, scope?: string | null): Record<string, string> {
  const safeTitle = JSON.stringify(title);
  const sourceLabel = scopeLabel(scope);
  const isoDate = new Date().toISOString().slice(0, 10);
  return {
    "package.json": JSON.stringify(
      {
        name: "landing-page",
        version: "0.1.0",
        private: true,
        scripts: { dev: "next dev", build: "next build", start: "next start" },
        dependencies: { next: "14.2.5", react: "18.3.1", "react-dom": "18.3.1" },
        devDependencies: {
          typescript: "5.4.5",
          "@types/node": "20.14.2",
          "@types/react": "18.3.3",
          "@types/react-dom": "18.3.0",
        },
      },
      null,
      2,
    ),
    "next.config.mjs": "/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nexport default nextConfig;\n",
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
          plugins: [{ name: "next" }],
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      },
      null,
      2,
    ),
    "app/layout.tsx":
      `import type { ReactNode } from "react";\nimport "./globals.css";\n\n` +
      `export const metadata = { title: ${safeTitle} };\n\n` +
      `export default function RootLayout({ children }: { children: ReactNode }) {\n` +
      `  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}\n`,
    "app/globals.css": "*, *::before, *::after { box-sizing: border-box; }\nhtml, body { margin: 0; padding: 0; }\n",
    ".gitignore": "node_modules\n.next\n.env*\n",
    "README.md":
      `# ${title}\n\n` +
      "Built with Pocket Agent — Landing Page Builder. This is your code, on your GitHub and your Vercel.\n\n" +
      `Built by Pocket Agent from your ${sourceLabel} brain · ${isoDate}\n\n` +
      "Run it locally:\n\n```\nnpm install\nnpm run dev\n```\n",
  };
}

// ── Code generation (metered Anthropic call, deterministic fallback) ──────────────────────────────

type AnthropicTextBlock = { type: "text"; text: string };
type AnthropicApiResponse = {
  content: AnthropicTextBlock[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

function looksLikeValidPage(src: string): boolean {
  return (
    /export\s+default\s+function/.test(src) &&
    src.includes("copy") &&
    !src.includes(COPY_PLACEHOLDER) &&
    src.length > 200
  );
}

/**
 * Serialize a DesignSystemSnapshot into a CSS custom-properties block the model can follow.
 * Returns an empty string when no snapshot is provided.
 */
function buildDsTokensBlock(ds: DesignSystemSnapshot | null | undefined): string {
  if (!ds) return "";

  const lines: string[] = [];

  // Palette → semantic role tokens
  for (const p of ds.palette ?? []) {
    if (p.hex && p.role) lines.push(`  --color-${p.role}: ${p.hex};`);
    else if (p.hex && p.name) lines.push(`  --color-${p.name.toLowerCase().replace(/\s+/g, "-")}: ${p.hex};`);
  }

  // Typography
  const h = ds.typography?.heading;
  const b = ds.typography?.body;
  if (h?.family) lines.push(`  --font-heading: '${h.family}', system-ui, sans-serif;`);
  if (b?.family) lines.push(`  --font-body: '${b.family}', system-ui, sans-serif;`);
  if (h?.weight) lines.push(`  --font-heading-weight: ${h.weight};`);
  if (b?.weight) lines.push(`  --font-body-weight: ${b.weight};`);

  if (!lines.length) return "";
  return `:root {\n${lines.join("\n")}\n}`;
}

/**
 * Generate the final app/page.tsx for a landing page. Asks the model to render the template skeleton
 * with the copy as a self-contained, default-exported component, validates the result, and degrades
 * to the deterministic fill on a transport error or an unusable response. The metered call (when it
 * returns a billable response) writes one pa_cost_events row via `cost`.
 */
export async function generateComponentCode(
  params: { template: LandingTemplate; copy: GeneratedCopy; designSystem?: DesignSystemSnapshot | null },
  anthropicApiKey: string,
  cost?: CostContext,
): Promise<string> {
  const deterministic = fillTemplate(params.template, params.copy);

  // A gallery direction carries its full design spec (PA-TG-7); the model follows it as far as one
  // self-contained page allows. The deterministic fallback already ships the direction's palette +
  // typography, so a model miss still looks like the direction, just simpler.
  const designSection = params.template.designBrief
    ? `\n\nDESIGN DIRECTION (follow it as far as a single self-contained page with inline styles allows — the palette, the typography, the section feel, the simpler motifs; skip anything that needs external packages or assets you don't have):\n${params.template.designBrief}`
    : "";

  // PA-LPB-10: inject the design system's CSS tokens when available so the model uses semantic
  // role variables instead of scattering raw hex values through every inline style object.
  const dsTokensBlock = buildDsTokensBlock(params.designSystem);
  const dsSection = dsTokensBlock
    ? `\n\nDESIGN SYSTEM TOKENS — use these CSS custom properties instead of hardcoding raw hex values. Emit a <style> tag at the top of the page JSX that declares these tokens, then reference them as var(--color-primary, #fallback) throughout the inline style objects:\n${dsTokensBlock}`
    : "";

  const system = `You generate a single Next.js App Router page component (app/page.tsx) for a landing page.

Here is a working skeleton. Keep its structure and styling approach (a single default-exported component, inline style objects, NO imports beyond React types, NO external packages, NO Tailwind). You may refine the layout and styling, but the result MUST compile as-is and render the provided copy faithfully.

SKELETON:
${params.template.componentTemplate}

The ${COPY_PLACEHOLDER} placeholder must be replaced with this exact copy object as a typed const:
const copy: Copy = ${JSON.stringify(params.copy, null, 2)};

RULES:
- Output ONLY the contents of app/page.tsx. No markdown fences, no commentary.
- It must contain "export default function" and reference the copy object.
- No imports except "import type" for React types if needed. No third-party packages.${designSection}${dsSection}`;

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CODE_MODEL,
        // A direction build renders a richer page than the starter skeletons — give it headroom.
        max_tokens: params.template.designBrief ? 8000 : 4000,
        system,
        messages: [{ role: "user", content: "Return the full app/page.tsx now — code only." }],
      }),
    });
  } catch {
    // Transport failure: no billable response, so no cost row — degrade to the deterministic fill.
    return deterministic;
  }

  if (!res.ok) {
    // Non-2xx: nothing realized to bill — degrade to the deterministic fill.
    return deterministic;
  }

  const msg = (await res.json()) as AnthropicApiResponse;
  if (cost) {
    await logCostFromUsage(cost, "anthropic", CODE_MODEL, {
      tokensInput: msg.usage?.input_tokens ?? 0,
      tokensOutput: msg.usage?.output_tokens ?? 0,
    });
  }

  const text = (msg.content.find((c) => c.type === "text")?.text ?? "")
    .trim()
    .replace(/^```(?:tsx|ts|jsx)?\s*/i, "")
    .replace(/\s*```$/, "");

  return looksLikeValidPage(text) ? text : deterministic;
}

/**
 * Assemble the full deployable project: generate the page component (metered) and combine it with the
 * static scaffold. Returns the bundle persisted on the page row (copy + files) so a later staged push
 * uses this exact generation. `scope` flows through to the README provenance line (PA-LPB-8).
 */
export async function assembleLandingBundle(
  params: {
    template: LandingTemplate;
    copy: GeneratedCopy;
    title: string;
    scope?: string | null;
    designSystem?: DesignSystemSnapshot | null;
  },
  anthropicApiKey: string,
  cost?: CostContext,
): Promise<GeneratedBundle> {
  const pageSource = await generateComponentCode(
    { template: params.template, copy: params.copy, designSystem: params.designSystem },
    anthropicApiKey,
    cost,
  );
  const files = { ...scaffoldFiles(params.title, params.scope), "app/page.tsx": pageSource };
  return { copy: params.copy, files };
}

// ── The build plan (one ordered sequence, shared by the loop and the stager) ──────────────────────

export const LANDING_BUILD_STEP_ORDER = [
  "create_repo",
  "push_files",
  "create_project",
  "trigger_deploy",
] as const;
export type BuildStepName = (typeof LANDING_BUILD_STEP_ORDER)[number];

export type PlannedStep = {
  step: BuildStepName;
  connector: "github_build" | "vercel";
  action: "create_repo" | "push_files" | "createProject" | "triggerDeploy";
  title: string;
  preview: string;
};

/** The ordered build plan for a page, friendly titles/previews for the approval cards. */
export function planLandingBuildSteps(slug: string): PlannedStep[] {
  return [
    {
      step: "create_repo",
      connector: "github_build",
      action: "create_repo",
      title: `Create the GitHub repo for "${slug}"`,
      preview: `Pocket Agent will create a new repository "${slug}" on your GitHub account to hold the page's code.`,
    },
    {
      step: "push_files",
      connector: "github_build",
      action: "push_files",
      title: `Add the page's files to "${slug}"`,
      preview: "Pocket Agent will commit the generated Next.js project (the page, layout, and config) to the repo.",
    },
    {
      step: "create_project",
      connector: "vercel",
      action: "createProject",
      title: `Create the Vercel project for "${slug}"`,
      preview: `Pocket Agent will create a Vercel project linked to the "${slug}" repo so it can deploy.`,
    },
    {
      step: "trigger_deploy",
      connector: "vercel",
      action: "triggerDeploy",
      title: `Deploy "${slug}"`,
      preview: "Pocket Agent will deploy the project so your page goes live at its own URL.",
    },
  ];
}

// ── The pure orchestrator loop (integration + auto-approve path) ──────────────────────────────────

export type StepOutcome =
  | { status: "executed"; data: Record<string, unknown> }
  | { status: "rejected"; reason: string }
  | { status: "failed"; error: string };

export type BuildRunContext = {
  slug: string;
  files: Record<string, string>;
  repoFullName: string | null;
  vercelProjectId: string | null;
  deployUrl: string | null;
};

export type StepRunner = (step: PlannedStep, ctx: BuildRunContext) => Promise<StepOutcome>;

export type RunBuildResult =
  | { ok: true; url: string }
  | { ok: false; stoppedAt: BuildStepName; reason: string };

function strField(data: Record<string, unknown>, key: string): string | null {
  const v = data[key];
  return typeof v === "string" && v ? v : null;
}

/**
 * Run the full build through an injected step runner, threading each step's output into the next, and
 * fail-stopping at the first non-executed step. Returns the live URL on success, or which step stopped
 * the build and why. Pure with respect to PA state — all side effects live in the runner.
 */
export async function runLandingPageBuild(args: {
  slug: string;
  files: Record<string, string>;
  runner: StepRunner;
}): Promise<RunBuildResult> {
  const ctx: BuildRunContext = {
    slug: args.slug,
    files: args.files,
    repoFullName: null,
    vercelProjectId: null,
    deployUrl: null,
  };

  for (const planned of planLandingBuildSteps(args.slug)) {
    const out = await args.runner(planned, ctx);
    if (out.status !== "executed") {
      return {
        ok: false,
        stoppedAt: planned.step,
        reason: out.status === "rejected" ? out.reason : out.error,
      };
    }
    if (planned.step === "create_repo") {
      ctx.repoFullName = strField(out.data, "full_name") ?? `local/${args.slug}`;
    } else if (planned.step === "create_project") {
      ctx.vercelProjectId = strField(out.data, "projectId");
    } else if (planned.step === "trigger_deploy") {
      ctx.deployUrl = strField(out.data, "url");
    }
  }

  return { ok: true, url: ctx.deployUrl ?? `https://${args.slug}.vercel.app` };
}

// ── Production stager input (one step per build cursor) ────────────────────────────────────────────

export type StagePlan = {
  connector: "github_build" | "vercel";
  action: "create_repo" | "push_files" | "createProject" | "triggerDeploy";
  payload: Record<string, unknown>;
  title: string;
  preview: string;
};

/** Map a build cursor to the connector action + payload to stage next, or null when nothing is staged
 *  (the 'plan', 'live', and 'failed' cursors don't stage a connector step here). The payload carries
 *  `landing_page_id` so the approval route can advance the build after the step executes. */
export function stagePlanFor(
  cursor: BuildStep,
  page: LandingPageRow,
  login: string | null,
): StagePlan | null {
  const slug = landingSlug(page.title, page.id);
  const steps = planLandingBuildSteps(slug);
  const fileEntries = page.generated_copy
    ? Object.entries(page.generated_copy.files).map(([path, content]) => ({ path, content }))
    : [];

  switch (cursor) {
    case "repo": {
      const s = steps[0];
      return {
        connector: s.connector,
        action: s.action,
        title: s.title,
        preview: s.preview,
        payload: {
          name: slug,
          private: true,
          description: `Landing page: ${page.title}`,
          landing_page_id: page.id,
          ...(page.project_id ? { project_id: page.project_id } : {}),
        },
      };
    }
    case "push": {
      const s = steps[1];
      return {
        connector: s.connector,
        action: s.action,
        title: s.title,
        preview: s.preview,
        payload: {
          repo: page.github_repo_name ?? slug,
          branch: "main",
          files: fileEntries,
          message: "Add landing page generated by Pocket Agent",
          landing_page_id: page.id,
        },
      };
    }
    case "project": {
      const s = steps[2];
      return {
        connector: s.connector,
        action: s.action,
        title: s.title,
        preview: s.preview,
        payload: {
          name: slug,
          framework: "nextjs",
          gitRepo: page.github_repo_name ?? (login ? `${login}/${slug}` : slug),
          landing_page_id: page.id,
          ...(page.project_id ? { projectId: page.project_id } : {}),
        },
      };
    }
    case "deploy": {
      const s = steps[3];
      if (!page.vercel_project_id) return null;
      return {
        connector: s.connector,
        action: s.action,
        title: s.title,
        preview: s.preview,
        payload: {
          projectId: page.vercel_project_id,
          ref: "main",
          production: true,
          landing_page_id: page.id,
        },
      };
    }
    default:
      return null;
  }
}

/** The build cursor that follows a just-executed connector action (the advance state machine). */
export function nextCursorAfter(action: string): BuildStep | null {
  switch (action) {
    case "create_repo":
      return "push";
    case "push_files":
      return "project";
    case "createProject":
      return "deploy";
    case "triggerDeploy":
      return "live";
    default:
      return null;
  }
}
