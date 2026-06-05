// GET /api/v1/openapi.json — the OpenAPI 3.1 spec for the Public REST API. Public
// (no key required); the spec itself carries no secrets. CORS-open so browser-based
// doc tools can fetch it.

import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/api-v1/openapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request): Response {
  const origin = new URL(req.url).origin;
  const doc = buildOpenApiDocument(`${origin}/api/v1`);
  return NextResponse.json(doc, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
