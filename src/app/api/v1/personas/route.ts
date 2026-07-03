// GET /api/v1/personas — list the user's personas (id, name, slug, mode, status).

import {
  handleV1,
  handlePreflight,
  v1Json,
  type V1Context,
  type V1HandlerResult,
} from "@/lib/api-v1/context";
import { personaListResponseSchema } from "@/lib/api-v1/schemas";
import { listPersonasForBusiness } from "@/lib/personas/db";
import { getPersonaDisplayName } from "@/lib/personas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request): Response {
  return handlePreflight(req);
}

export function GET(req: Request): Promise<Response> {
  return handleV1(req, personasHandler);
}

async function personasHandler(_req: Request, ctx: V1Context): Promise<V1HandlerResult> {
  const rows = await listPersonasForBusiness(ctx.userId);
  const personas = rows.map((p) => ({
    id: p.id,
    name: getPersonaDisplayName(p),
    slug: p.slug,
    mode: p.mode,
    status: p.status,
  }));
  const body = personaListResponseSchema.parse({ personas });
  return { response: v1Json(body) };
}
