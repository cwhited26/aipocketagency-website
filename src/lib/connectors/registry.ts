// lib/connectors/registry.ts — the single point where the approval route decides whether an
// approved connector action runs IN-PROCESS (TypeScript + direct REST, like Slack) or REMOTELY
// (a Modal sub-agent resumes its blocked tool call via notifyApproval). Slack is the first
// in-process connector; new ones register here.

import { executeSlackAction, SLACK_CONNECTOR, type SlackExecuteResult } from "./slack/execute";
import {
  executeQuickBooksConnectorAction,
  QUICKBOOKS_CONNECTOR,
  type QuickBooksExecuteResult,
} from "./quickbooks/execute";
import { executeStripeAction, STRIPE_CONNECTOR, type StripeExecuteResult } from "./stripe";
import { executeZoomAction, ZOOM_CONNECTOR, type ZoomExecuteResult } from "./zoom";
import {
  executeModalSandboxConnectorAction,
  MODAL_SANDBOX_CONNECTOR,
  type ModalSandboxExecuteResult,
} from "./modal-sandbox/execute";
import {
  executeGithubBuildAction,
  GITHUB_BUILD_CONNECTOR,
  type GithubBuildExecuteResult,
} from "./github-build/actions";
import {
  executeVercelConnectorAction,
  VERCEL_CONNECTOR,
  type VercelExecuteResult,
} from "./vercel/execute";
import {
  executeSupabaseConnectorAction,
  SUPABASE_CONNECTOR,
  type SupabaseExecuteResult,
} from "./supabase";
import {
  executeBrainConnectorAction,
  BRAIN_CONNECTOR,
  type BrainExecuteResult,
} from "@/lib/competitor-inspector/execute";

// All in-process executors share the same terminal result shape ({ok,summary,data} |
// {ok,status,error}); the union keeps that explicit as more connectors register.
export type ConnectorExecuteResult =
  | SlackExecuteResult
  | QuickBooksExecuteResult
  | StripeExecuteResult
  | ZoomExecuteResult
  | ModalSandboxExecuteResult
  | GithubBuildExecuteResult
  | VercelExecuteResult
  | SupabaseExecuteResult
  | BrainExecuteResult;

export type ExecuteConnectorActionInput = {
  connector: string;
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  subAgentRunId?: string | null;
  ownerEmail?: string | null;
  /**
   * Idempotency seed for connectors that need one (QuickBooks financial writes pass it as the
   * QBO Request-Id). Pass the approval id so a retry/crash-resume can't double-post.
   */
  requestId?: string | null;
};

/**
 * Run an approved connector action server-side when the connector has an in-process executor.
 * Returns undefined when the connector executes remotely — the caller then notifies the runtime
 * to resume the blocked call instead of running anything here.
 */
export async function executeConnectorAction(
  input: ExecuteConnectorActionInput,
): Promise<ConnectorExecuteResult | undefined> {
  if (input.connector === SLACK_CONNECTOR) {
    return executeSlackAction({
      userId: input.userId,
      action: input.action,
      payload: input.payload,
      subAgentRunId: input.subAgentRunId ?? null,
      ownerEmail: input.ownerEmail ?? null,
    });
  }
  if (input.connector === QUICKBOOKS_CONNECTOR) {
    return executeQuickBooksConnectorAction({
      userId: input.userId,
      action: input.action,
      payload: input.payload,
      subAgentRunId: input.subAgentRunId ?? null,
      ownerEmail: input.ownerEmail ?? null,
      requestId: input.requestId ?? null,
    });
  }
  if (input.connector === STRIPE_CONNECTOR) {
    // Stripe derives its own idempotency key from (run + action + payload hash) internally
    // (roadmap §3.2), so it doesn't need requestId threaded here.
    return executeStripeAction({
      userId: input.userId,
      action: input.action,
      payload: input.payload,
      subAgentRunId: input.subAgentRunId ?? null,
      ownerEmail: input.ownerEmail ?? null,
    });
  }
  if (input.connector === ZOOM_CONNECTOR) {
    return executeZoomAction({
      userId: input.userId,
      action: input.action,
      payload: input.payload,
      subAgentRunId: input.subAgentRunId ?? null,
      ownerEmail: input.ownerEmail ?? null,
    });
  }
  if (input.connector === MODAL_SANDBOX_CONNECTOR) {
    // Code execution against the Wave B Modal app. spawn_container also records its container id
    // back to the Project Workspace; run_command with a shell-special command is single-approval
    // forever (lib/connectors/modal-sandbox/commands.ts).
    return executeModalSandboxConnectorAction({
      userId: input.userId,
      action: input.action,
      payload: input.payload,
      subAgentRunId: input.subAgentRunId ?? null,
      ownerEmail: input.ownerEmail ?? null,
    });
  }
  if (input.connector === GITHUB_BUILD_CONNECTOR) {
    return executeGithubBuildAction({
      userId: input.userId,
      action: input.action,
      payload: input.payload,
      subAgentRunId: input.subAgentRunId ?? null,
      ownerEmail: input.ownerEmail ?? null,
    });
  }
  if (input.connector === VERCEL_CONNECTOR) {
    // Vercel (build connector #2) executes in-process via direct REST. createProject writes its new
    // project back to the originating PA project's Workspace row inside the executor.
    return executeVercelConnectorAction({
      userId: input.userId,
      action: input.action,
      payload: input.payload,
      subAgentRunId: input.subAgentRunId ?? null,
      ownerEmail: input.ownerEmail ?? null,
    });
  }
  if (input.connector === BRAIN_CONNECTOR) {
    // The Competitor Inspector's staged profile commit (recon Lane C): writes the generated
    // profile + extraction log + screenshots to the owner's own brain repo in one commit.
    return executeBrainConnectorAction({
      userId: input.userId,
      action: input.action,
      payload: input.payload,
    });
  }
  if (input.connector === SUPABASE_CONNECTOR) {
    // Supabase resolves its own connection + decrypts the PAT internally, decrypts the staged
    // db_pass at run time, and links a created project back to the Project Workspace.
    return executeSupabaseConnectorAction({
      userId: input.userId,
      action: input.action,
      payload: input.payload,
      subAgentRunId: input.subAgentRunId ?? null,
    });
  }
  return undefined;
}
