// GET /api/v1/zones — list the user's ContainmentGuard ("Privacy zones") config so an
// external agent sees exactly the same zone boundaries as internal PA agents.

import {
  handleV1,
  handlePreflight,
  v1Json,
  type V1Context,
  type V1HandlerResult,
} from "@/lib/api-v1/context";
import { zonesResponseSchema } from "@/lib/api-v1/schemas";
import { loadZoneConfig, isPrivateZone } from "@/lib/brain/containment-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request): Response {
  return handlePreflight(req);
}

export function GET(req: Request): Promise<Response> {
  return handleV1(req, zonesHandler);
}

async function zonesHandler(_req: Request, ctx: V1Context): Promise<V1HandlerResult> {
  if (!ctx.paUser?.brain_repo) {
    return { response: v1Json({ error: "No brain repo connected." }, 404) };
  }
  const { brain_repo, github_token } = ctx.paUser;
  const { config, isDefault } = await loadZoneConfig(brain_repo, github_token);

  const zones = Object.entries(config.zones).map(([name, patterns]) => ({
    name,
    patterns,
    private: isPrivateZone(name),
  }));

  const body = zonesResponseSchema.parse({ zones, isDefault });
  return { response: v1Json(body) };
}
