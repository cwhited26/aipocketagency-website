// POST /api/v1/memory/entry — write a new memory entry. Tier is taken from the body
// when provided, else auto-classified from the name + content (memory-tier.ts).

import {
  handleV1,
  handlePreflight,
  v1Json,
  type V1Context,
  type V1HandlerResult,
} from "@/lib/api-v1/context";
import {
  memoryEntryBodySchema,
  memoryEntryResponseSchema,
  type ApiMemoryTier,
} from "@/lib/api-v1/schemas";
import { folderForApiTier, internalTierToApi } from "@/lib/api-v1/memory-map";
import { classifyMemoryTier } from "@/lib/brain/memory-tier";
import { commitMemoryFile } from "@/lib/pa-brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request): Response {
  return handlePreflight(req);
}

export function POST(req: Request): Promise<Response> {
  return handleV1(req, entryHandler);
}

function toMdFilename(name: string): string {
  const base = name.endsWith(".md") ? name.slice(0, -3) : name;
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug || "entry"}.md`;
}

async function entryHandler(req: Request, ctx: V1Context): Promise<V1HandlerResult> {
  if (!ctx.paUser?.brain_repo) {
    return { response: v1Json({ error: "No brain repo connected." }, 404) };
  }
  if (!ctx.paUser.github_token) {
    return { response: v1Json({ error: "No write token — reconnect your brain repo with write access." }, 409) };
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { response: v1Json({ error: "Invalid JSON" }, 400) };
  }
  const parsed = memoryEntryBodySchema.safeParse(raw);
  if (!parsed.success) {
    return { response: v1Json({ error: parsed.error.message }, 422) };
  }

  const filename = toMdFilename(parsed.data.name);
  let apiTier: ApiMemoryTier;
  let reason: string;
  if (parsed.data.tier) {
    apiTier = parsed.data.tier;
    reason = "explicit tier from request";
  } else {
    const classified = classifyMemoryTier(filename, parsed.data.content);
    apiTier = internalTierToApi(classified.tier);
    reason = classified.reason;
  }

  const folder = folderForApiTier(apiTier);
  const path = `${folder}/${filename}`;

  const { brain_repo, github_token } = ctx.paUser;
  const result = await commitMemoryFile({
    repo: brain_repo,
    token: github_token,
    path,
    mode: "replace",
    content: parsed.data.content,
    commitMessage: `api: add memory entry ${path}`,
  });
  if (!result.ok) {
    return { response: v1Json({ error: result.error }, 502) };
  }
  const body = memoryEntryResponseSchema.parse({
    path,
    tier: apiTier,
    sha: result.sha,
    classifiedReason: reason,
  });
  return { response: v1Json(body, 201) };
}
