// landing-pages/brand-brain.ts — write a generated design system back to the owner's brain as
// brand.json inside a project scope folder (PA-LPB-12). The write goes through the GitHub
// connector's push_files action — the hard-rule "never auto-approve" connector (the same gate
// that governs push_files in the LPB build) — so the owner sees a build_action_approval card
// and decides before anything commits.
//
// If brand.json already exists at the scope root, the staging function reads it and surfaces the
// "Replace existing brand.json?" flag in the approval card preview so the owner can make an
// informed call. Never silently overwrites.

import { stageConnectorAction, scopeToken } from "@/lib/orchestrator/tool-use";
import { fetchFileContent } from "@/lib/pa-brain";
import type { DesignSystem } from "@/lib/connectors/moonchild/types";

// ── Brand JSON ────────────────────────────────────────────────────────────────────────────────────

/** The shape written to brand.json in the scope folder. A subset of DesignSystem + provenance. */
export type BrandJson = {
  name: string;
  palette?: DesignSystem["palette"];
  typography?: DesignSystem["typography"];
  components?: DesignSystem["components"];
  domain?: string;
  generatedFrom?: string;
  generatedAt: string;
};

function buildBrandJson(brand: {
  name: string;
  ds: DesignSystem;
  sourceUrl: string;
  domain?: string;
}): BrandJson {
  return {
    name: brand.name,
    ...(brand.ds.palette?.length ? { palette: brand.ds.palette } : {}),
    ...(brand.ds.typography ? { typography: brand.ds.typography } : {}),
    ...(brand.ds.components && Object.keys(brand.ds.components).length ? { components: brand.ds.components } : {}),
    ...(brand.domain ? { domain: brand.domain } : {}),
    generatedFrom: brand.sourceUrl,
    generatedAt: new Date().toISOString(),
  };
}

// ── hasExistingBrandJson ──────────────────────────────────────────────────────────────────────────

/**
 * Check whether brand.json already exists at the given scope root. Used by the wizard to gate the
 * "Replace existing brand.json?" confirmation step. Never throws; returns false on any failure.
 */
export async function hasExistingBrandJson(
  brainRepo: string,
  githubToken: string | null,
  scope: string,
): Promise<boolean> {
  try {
    const content = await fetchFileContent(brainRepo, `${scope}/brand.json`, githubToken);
    return content != null && content.length > 0;
  } catch {
    return false;
  }
}

// ── readExistingBrandJson ─────────────────────────────────────────────────────────────────────────

/**
 * Read the existing brand.json at the scope root. Returns null when it doesn't exist or can't be
 * parsed. Used by the "Use this project's existing DS" wizard path.
 */
export async function readExistingBrandJson(
  brainRepo: string,
  githubToken: string | null,
  scope: string,
): Promise<BrandJson | null> {
  try {
    const raw = await fetchFileContent(brainRepo, `${scope}/brand.json`, githubToken);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as BrandJson;
  } catch {
    return null;
  }
}

// ── stageBrandJsonWrite ───────────────────────────────────────────────────────────────────────────

export type BrandWriteParams = {
  ownerId: string;
  brainRepo: string;
  githubToken: string | null;
  scope: string;
  brand: {
    name: string;
    ds: DesignSystem;
    sourceUrl: string;
    domain?: string;
  };
  /** When true, the card preview prominently flags that an existing brand.json will be replaced. */
  replacingExisting: boolean;
  landingPageId: string;
};

export type BrandWriteResult = { ok: true; staged: true } | { ok: false; status: number; error: string };

/**
 * Stage a push_files approval card that will commit brand.json to `<scope>/brand.json` in the
 * owner's brain repo. The card is a build_action_approval of connector github_build / push_files —
 * the same hard-rule never-auto-approved action that the LPB build uses for code files. The owner
 * taps Approve in Mission Control; the existing connector executor does the actual commit.
 *
 * The brand.json content is serialised here and embedded in the staged payload so the approval
 * card shows the owner exactly what will be written before they approve (PA-LPB-12).
 */
export async function stageBrandJsonWrite(params: BrandWriteParams): Promise<BrandWriteResult> {
  const brandJson = buildBrandJson(params.brand);
  const content = JSON.stringify(brandJson, null, 2);
  const filePath = `${params.scope}/brand.json`;

  const palettePreview =
    brandJson.palette
      ?.slice(0, 3)
      .map((p) => `${p.name ?? "color"}: ${p.hex ?? "—"}`)
      .join(", ") ?? "no palette";

  const replacingNote = params.replacingExisting
    ? "\n\n⚠️ This will REPLACE the existing brand.json in this folder. Review the preview carefully."
    : "";

  const preview =
    `Pocket Agent will write brand.json to \`${filePath}\` in your brain (${params.brainRepo}).\n\n` +
    `Palette: ${palettePreview}\n` +
    `Typography: ${brandJson.typography?.heading?.family ?? "—"} heading / ${brandJson.typography?.body?.family ?? "—"} body\n` +
    `Source: ${params.brand.sourceUrl}` +
    replacingNote;

  const title = params.replacingExisting
    ? `Replace brand.json for "${params.brand.name}" in your brain`
    : `Write brand.json for "${params.brand.name}" to your brain`;

  try {
    await stageConnectorAction({
      userId: params.ownerId,
      subAgentRunId: null,
      connector: "github_build",
      action: "push_files",
      payload: {
        repo: params.brainRepo,
        branch: "main",
        files: [{ path: filePath, content }],
        message: `Add brand.json for ${params.scope} — generated by Pocket Agent from ${params.brand.sourceUrl}`,
        landing_page_id: params.landingPageId,
        brand_json_write: true,
      },
      declaredScopes: [scopeToken("github_build", "push_files")],
      title,
      preview,
      kind: "build_action_approval",
    });
    return { ok: true, staged: true };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "Failed to stage brand.json write",
    };
  }
}
