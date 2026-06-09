// POST /api/connectors/github-build/action  { action, payload, subAgentRunId? }
//
// The internal entry point that STAGES a GitHub Build action to the owner's Approval Inbox. Build
// actions never fire inline — every create_repo / push_files / create_branch / open_pull_request
// lands as a kind='build_action_approval' card and only executes when the owner approves it on the
// Inbox (which calls /api/orchestrator/approvals/[id] → executeConnectorAction → this connector).
//
// The payload is validated against the per-action schema HERE so a malformed request is rejected
// at stage time rather than surfacing as a failure after approval. The connection must be live.

import { createClient } from "@/lib/supabase/server";
import { fetchGithubBuildConnectionPublic } from "@/lib/pa-github-build-connections";
import { isGithubBuildOAuthConfigured } from "@/lib/connectors/github-build/oauth";
import {
  GITHUB_BUILD_CONNECTOR,
  isGithubBuildAction,
  CreateRepoInputSchema,
  PushFilesInputSchema,
  CreateBranchInputSchema,
  OpenPullRequestInputSchema,
} from "@/lib/connectors/github-build/actions";
import type { GithubBuildActionName } from "@/lib/connectors/github-build/types";
import { stageConnectorAction, ConnectorScopeError } from "@/lib/orchestrator/tool-use";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  action: z.string().min(1).max(60),
  payload: z.record(z.string(), z.unknown()),
  subAgentRunId: z.string().min(1).max(200).optional(),
});

// Validate + normalize the payload for the named action, returning the parsed payload plus a plain
// title + preview for the approval card. Returns an error string when the payload is malformed.
function prepare(
  action: GithubBuildActionName,
  payload: Record<string, unknown>,
):
  | { ok: true; payload: Record<string, unknown>; title: string; preview: string }
  | { ok: false; error: string } {
  switch (action) {
    case "create_repo": {
      const p = CreateRepoInputSchema.safeParse(payload);
      if (!p.success) return { ok: false, error: p.error.message };
      return {
        ok: true,
        payload: p.data,
        title: `Create ${p.data.private ? "private" : "public"} repo "${p.data.name}"`,
        preview:
          `New repository: ${p.data.name} (${p.data.private ? "private" : "public"})` +
          (p.data.description ? `\nDescription: ${p.data.description}` : ""),
      };
    }
    case "push_files": {
      const p = PushFilesInputSchema.safeParse(payload);
      if (!p.success) return { ok: false, error: p.error.message };
      const list = p.data.files.map((f) => `  • ${f.path}`).join("\n");
      return {
        ok: true,
        payload: p.data,
        title: `Push ${p.data.files.length} file${p.data.files.length === 1 ? "" : "s"} to ${p.data.repo}@${p.data.branch}`,
        preview: `Commit: ${p.data.message}\nBranch: ${p.data.branch}\nFiles:\n${list}`,
      };
    }
    case "create_branch": {
      const p = CreateBranchInputSchema.safeParse(payload);
      if (!p.success) return { ok: false, error: p.error.message };
      return {
        ok: true,
        payload: p.data,
        title: `Create branch "${p.data.name}" on ${p.data.repo}`,
        preview: `New branch: ${p.data.name}\nFrom: ${p.data.base}\nRepo: ${p.data.repo}`,
      };
    }
    case "open_pull_request": {
      const p = OpenPullRequestInputSchema.safeParse(payload);
      if (!p.success) return { ok: false, error: p.error.message };
      return {
        ok: true,
        payload: p.data,
        title: `Open PR "${p.data.title}" on ${p.data.repo}`,
        preview:
          `Pull request: ${p.data.title}\n${p.data.head} → ${p.data.base}\nRepo: ${p.data.repo}` +
          (p.data.body ? `\n\n${p.data.body}` : ""),
      };
    }
    default: {
      const _never: never = action;
      return { ok: false, error: `Unknown action: ${String(_never)}` };
    }
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isGithubBuildOAuthConfigured()) {
    return NextResponse.json(
      { error: "GitHub Build isn't configured for this workspace." },
      { status: 503 },
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    body = BodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!isGithubBuildAction(body.action)) {
    return NextResponse.json({ error: `Unknown GitHub Build action: ${body.action}` }, { status: 400 });
  }

  // The connection must be live before staging anything.
  const conn = await fetchGithubBuildConnectionPublic(user.id);
  if (!conn.ok) return NextResponse.json({ error: conn.error }, { status: conn.status });
  if (!conn.data || conn.data.status === "revoked") {
    return NextResponse.json(
      { error: "Connect GitHub Build in Settings → Connections first." },
      { status: 409 },
    );
  }

  const prepared = prepare(body.action, body.payload);
  if (!prepared.ok) {
    return NextResponse.json({ error: prepared.error }, { status: 422 });
  }

  try {
    const staged = await stageConnectorAction({
      userId: user.id,
      subAgentRunId: body.subAgentRunId ?? null,
      connector: GITHUB_BUILD_CONNECTOR,
      action: body.action,
      payload: prepared.payload,
      // Owner-initiated stage: the connector scope is granted by the owner invoking this route.
      declaredScopes: [GITHUB_BUILD_CONNECTOR],
      title: prepared.title,
      preview: prepared.preview,
      kind: "build_action_approval",
    });
    return NextResponse.json({
      staged: true,
      inboxItemId: staged.inboxItemId,
      autoApproved: staged.autoApproved,
    });
  } catch (e) {
    if (e instanceof ConnectorScopeError) {
      return NextResponse.json({ error: e.userMessage }, { status: 403 });
    }
    throw e;
  }
}
