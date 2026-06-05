// GET /api/v1/memory/tier?tier=work|knowledge|patterns — list memory entries in a tier.

import {
  handleV1,
  handlePreflight,
  v1Json,
  type V1Context,
  type V1HandlerResult,
} from "@/lib/api-v1/context";
import { memoryTierQuerySchema, memoryTierResponseSchema } from "@/lib/api-v1/schemas";
import { folderForApiTier } from "@/lib/api-v1/memory-map";
import { listDirMarkdownFiles } from "@/lib/pa-brain";
import { loadZoneConfig, partitionReadablePaths } from "@/lib/brain/containment-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request): Response {
  return handlePreflight(req);
}

export function GET(req: Request): Promise<Response> {
  return handleV1(req, tierHandler);
}

async function tierHandler(req: Request, ctx: V1Context): Promise<V1HandlerResult> {
  if (!ctx.paUser?.brain_repo) {
    return { response: v1Json({ error: "No brain repo connected." }, 404) };
  }
  const parsed = memoryTierQuerySchema.safeParse({
    tier: new URL(req.url).searchParams.get("tier") ?? "",
  });
  if (!parsed.success) {
    return { response: v1Json({ error: parsed.error.message }, 422) };
  }
  const { brain_repo, github_token } = ctx.paUser;
  const folder = folderForApiTier(parsed.data.tier);
  const files = await listDirMarkdownFiles(brain_repo, github_token, folder);

  // ContainmentGuard: drop any entries that resolve to a private zone.
  const { config } = await loadZoneConfig(brain_repo, github_token);
  const { allowed } = partitionReadablePaths(
    files.map((f) => f.path),
    config,
    "agent-read",
  );
  const allowedSet = new Set(allowed);
  const entries = files.filter((f) => allowedSet.has(f.path)).map((f) => ({ name: f.name, path: f.path }));

  const body = memoryTierResponseSchema.parse({ tier: parsed.data.tier, entries });
  return { response: v1Json(body) };
}
