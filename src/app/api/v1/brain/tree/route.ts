// GET /api/v1/brain/tree — list the user's brain files + folders. ContainmentGuard
// zone-filtered: private-zone blobs are dropped (count returned as blockedCount).

import {
  handleV1,
  handlePreflight,
  v1Json,
  type V1Context,
  type V1HandlerResult,
} from "@/lib/api-v1/context";
import { brainTreeResponseSchema } from "@/lib/api-v1/schemas";
import { listRepoTree } from "@/lib/pa-brain";
import { loadZoneConfig, partitionReadablePaths } from "@/lib/brain/containment-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request): Response {
  return handlePreflight(req);
}

export function GET(req: Request): Promise<Response> {
  return handleV1(req, treeHandler);
}

async function treeHandler(_req: Request, ctx: V1Context): Promise<V1HandlerResult> {
  if (!ctx.paUser?.brain_repo) {
    return { response: v1Json({ error: "No brain repo connected." }, 404) };
  }
  const { brain_repo, github_token } = ctx.paUser;
  const entries = await listRepoTree(brain_repo, github_token);
  const { config } = await loadZoneConfig(brain_repo, github_token);

  const blobPaths = entries.filter((e) => e.type === "blob").map((e) => e.path);
  const { allowed, blocked } = partitionReadablePaths(blobPaths, config, "agent-read");
  const allowedSet = new Set(allowed);

  const tree = entries
    .filter((e) => e.type === "tree" || allowedSet.has(e.path))
    .map((e) => ({ path: e.path, type: e.type }));

  const body = brainTreeResponseSchema.parse({ tree, blockedCount: blocked.length });
  return { response: v1Json(body) };
}
