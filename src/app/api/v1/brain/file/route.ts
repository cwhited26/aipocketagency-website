// GET  /api/v1/brain/file?path=<path> — read a brain file. ContainmentGuard enforced.
// POST /api/v1/brain/file                — write a brain file. ContainmentGuard enforced.

import {
  handleV1,
  handlePreflight,
  v1Json,
  type V1Context,
  type V1HandlerResult,
} from "@/lib/api-v1/context";
import {
  brainFileQuerySchema,
  brainFileReadResponseSchema,
  brainFileWriteBodySchema,
  brainFileWriteResponseSchema,
} from "@/lib/api-v1/schemas";
import { fetchFileContent, commitMemoryFile } from "@/lib/pa-brain";
import {
  assertReadAllowed,
  loadZoneConfig,
  ContainmentBlockedError,
} from "@/lib/brain/containment-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request): Response {
  return handlePreflight(req);
}

export function GET(req: Request): Promise<Response> {
  return handleV1(req, readHandler);
}

export function POST(req: Request): Promise<Response> {
  return handleV1(req, writeHandler);
}

async function readHandler(req: Request, ctx: V1Context): Promise<V1HandlerResult> {
  if (!ctx.paUser?.brain_repo) {
    return { response: v1Json({ error: "No brain repo connected." }, 404) };
  }
  const parsed = brainFileQuerySchema.safeParse({
    path: new URL(req.url).searchParams.get("path") ?? "",
  });
  if (!parsed.success) {
    return { response: v1Json({ error: parsed.error.message }, 422) };
  }
  const { brain_repo, github_token } = ctx.paUser;
  const { config } = await loadZoneConfig(brain_repo, github_token);
  try {
    assertReadAllowed(parsed.data.path, config, "agent-read");
  } catch (e) {
    if (e instanceof ContainmentBlockedError) {
      return { response: v1Json({ error: e.userMessage }, 403) };
    }
    throw e;
  }
  const content = await fetchFileContent(brain_repo, parsed.data.path, github_token);
  if (!content) {
    return { response: v1Json({ error: "File not found or empty." }, 404) };
  }
  const body = brainFileReadResponseSchema.parse({ path: parsed.data.path, content });
  return { response: v1Json(body) };
}

async function writeHandler(req: Request, ctx: V1Context): Promise<V1HandlerResult> {
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
  const parsed = brainFileWriteBodySchema.safeParse(raw);
  if (!parsed.success) {
    return { response: v1Json({ error: parsed.error.message }, 422) };
  }
  const { brain_repo, github_token } = ctx.paUser;
  const { config } = await loadZoneConfig(brain_repo, github_token);

  // Same privacy zones for external agents as internal PA agents: a write that targets
  // a private zone is refused (fail-closed), mirroring the read guard.
  try {
    assertReadAllowed(parsed.data.path, config, "agent-read");
  } catch (e) {
    if (e instanceof ContainmentBlockedError) {
      return { response: v1Json({ error: e.userMessage }, 403) };
    }
    throw e;
  }

  const result = await commitMemoryFile({
    repo: brain_repo,
    token: github_token,
    path: parsed.data.path,
    mode: parsed.data.mode,
    content: parsed.data.content,
    commitMessage: parsed.data.commitMessage ?? `api: write ${parsed.data.path}`,
  });
  if (!result.ok) {
    return { response: v1Json({ error: result.error }, 502) };
  }
  const body = brainFileWriteResponseSchema.parse({
    path: parsed.data.path,
    sha: result.sha,
    committed: true,
  });
  return { response: v1Json(body) };
}
