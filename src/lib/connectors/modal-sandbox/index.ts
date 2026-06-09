// connectors/modal-sandbox/index.ts — the Modal Sandbox connector's policy surface: the action
// registry, the per-(action, payload) approval gate, and the auto-approve eligibility rules. The
// approval middleware + UI consult these to decide what stages, what auto-fires, and what can
// NEVER auto-fire. Execution lives in execute.ts (the registry-facing half).
//
// Build Tools Roadmap §7.4 / §9.3, PA-BUILD-4. Modal is platform infra (no OAuth) — this connector
// drives the Wave B Modal app with the platform credentials.

import { modalSandboxActionGate } from "./actions";
import { isDangerousCommand } from "./commands";
import type { ModalSandboxActionName, SandboxGate } from "./types";

export { MODAL_SANDBOX_CONNECTOR } from "./types";
export type { ModalSandboxActionName, SandboxGate } from "./types";
export {
  MODAL_SANDBOX_ACTIONS,
  isModalSandboxAction,
  modalSandboxActionGate,
} from "./actions";
export { isDangerousCommand, dangerReason } from "./commands";

/** Read-only actions bypass the Approval Inbox entirely (get_container_status). */
export function isModalSandboxReadOnly(
  action: ModalSandboxActionName,
  payload: Record<string, unknown>,
): boolean {
  return modalSandboxActionGate(action, payload) === "read";
}

/** Un-gated mutating actions that run without an approval (stop_container — cleanup only). */
export function isModalSandboxAutoExecute(
  action: ModalSandboxActionName,
  payload: Record<string, unknown>,
): boolean {
  return modalSandboxActionGate(action, payload) === "auto";
}

/** Actions that need a staged approval before they fire (spawn_container, run_command). */
export function isModalSandboxGated(
  action: ModalSandboxActionName,
  payload: Record<string, unknown>,
): boolean {
  const gate: SandboxGate = modalSandboxActionGate(action, payload);
  return gate === "gated" || gate === "always_gated";
}

/**
 * Can NEVER become auto-approve eligible regardless of success_count. This is the load-bearing
 * guardrail (task item 3, Roadmap §11): a run_command whose command is shell-special or
 * destructive is single-approval FOREVER. The auto-approve toggle route consults this to refuse
 * enabling it, and the staging layer consults it to keep such a command gated no matter the count.
 */
export function isModalSandboxNeverAutoApprove(
  action: ModalSandboxActionName,
  payload: Record<string, unknown>,
): boolean {
  if (action === "run_command") {
    const command = typeof payload.command === "string" ? payload.command : "";
    return isDangerousCommand(command);
  }
  return false;
}
