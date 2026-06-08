// lib/connectors/registry.ts — the single point where the approval route decides whether an
// approved connector action runs IN-PROCESS (TypeScript + direct REST, like Slack) or REMOTELY
// (a Modal sub-agent resumes its blocked tool call via notifyApproval). Slack is the first
// in-process connector; new ones register here.

import { executeSlackAction, SLACK_CONNECTOR, type SlackExecuteResult } from "./slack/execute";

export type ConnectorExecuteResult = SlackExecuteResult;

export type ExecuteConnectorActionInput = {
  connector: string;
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  subAgentRunId?: string | null;
  ownerEmail?: string | null;
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
  return undefined;
}
