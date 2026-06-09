// connectors/modal-sandbox/actions.ts — the four Modal Sandbox actions as direct-REST calls
// against the Modal app's `/sandbox/*` endpoints (Build Tools Roadmap §7.4, task item 3):
//
//   spawnContainer      — gated (trust window applies). Creates an ephemeral, per-project
//                         container, optionally mounting a GitHub repo.
//   runCommand          — gated for ordinary build commands (pnpm install / build / test,
//                         npm run lint); always_gated — single-approval FOREVER — for any command
//                         with a shell-special char or a network/destructive tool (see commands.ts).
//   stopContainer       — no approval (cleanup only); tears the container down.
//   getContainerStatus  — read-only; polls whether the container is still running.
//
// These are PURE network calls + input validation. Gating, approval, and audit logging live in
// index.ts / execute.ts and the approval route — an action function never decides whether it was
// allowed to run, only how to run it.

import { z } from "zod";
import { callSandbox, type SandboxCallResult } from "./client";
import { runCommandGate } from "./commands";
import type {
  ContainerStatusResult,
  ModalSandboxActionMeta,
  ModalSandboxActionName,
  RunCommandResult,
  SandboxGate,
  SpawnContainerResult,
  StopContainerResult,
} from "./types";
import { MODAL_SANDBOX_CONNECTOR } from "./types";

// ── Input schemas (validated before any network call) ──────────────────────────────────────
export const SpawnContainerInputSchema = z.object({
  // The originating Project (Wave B Scaffolding plan). The container's artifact is recorded back
  // to this Project's Workspace on success (Roadmap §7.5, task item 5).
  project_id: z.string().min(1),
  // Optional container image override; the runtime defaults to a node + pnpm + git image.
  image: z.string().min(1).optional(),
  // Optional GitHub repo to clone into the container (e.g. "owner/name").
  repo: z.string().min(1).optional(),
  // Optional token for cloning a private repo (the owner's GitHub token).
  repo_token: z.string().min(1).optional(),
  // Optional TTL so a forgotten container can't run up cost; the runtime caps it.
  ttl_seconds: z.number().int().positive().max(7200).optional(),
});
export type SpawnContainerInput = z.infer<typeof SpawnContainerInputSchema>;

export const RunCommandInputSchema = z.object({
  container_id: z.string().min(1),
  command: z.string().min(1),
  // Working directory inside the container; defaults to the cloned repo root.
  workdir: z.string().min(1).optional(),
});
export type RunCommandInput = z.infer<typeof RunCommandInputSchema>;

export const StopContainerInputSchema = z.object({
  container_id: z.string().min(1),
});
export type StopContainerInput = z.infer<typeof StopContainerInputSchema>;

export const GetContainerStatusInputSchema = z.object({
  container_id: z.string().min(1),
});
export type GetContainerStatusInput = z.infer<typeof GetContainerStatusInputSchema>;

// ── Direct-REST action functions ────────────────────────────────────────────────────────────

/** Spawn an ephemeral, per-project container (optionally cloning a GitHub repo). */
export function spawnContainer(
  input: SpawnContainerInput,
): Promise<SandboxCallResult<SpawnContainerResult>> {
  return callSandbox<SpawnContainerResult>("/sandbox/spawn", {
    project_id: input.project_id,
    image: input.image ?? null,
    repo: input.repo ?? null,
    repo_token: input.repo_token ?? null,
    ttl_seconds: input.ttl_seconds ?? null,
  });
}

/** Run a command in an existing container. Idempotent per (container_id, command) at the runtime. */
export function runCommand(input: RunCommandInput): Promise<SandboxCallResult<RunCommandResult>> {
  return callSandbox<RunCommandResult>("/sandbox/run", {
    container_id: input.container_id,
    command: input.command,
    workdir: input.workdir ?? null,
  });
}

/** Stop + clean up a container. Cleanup is idempotent — stopping an already-gone container is ok. */
export function stopContainer(
  input: StopContainerInput,
): Promise<SandboxCallResult<StopContainerResult>> {
  return callSandbox<StopContainerResult>("/sandbox/stop", {
    container_id: input.container_id,
  });
}

/** Read-only: poll whether a container is still running. */
export function getContainerStatus(
  input: GetContainerStatusInput,
): Promise<SandboxCallResult<ContainerStatusResult>> {
  return callSandbox<ContainerStatusResult>("/sandbox/status", {
    container_id: input.container_id,
  });
}

// ── Action registry (meta only — safe to surface in the UI / scope lists) ───────────────────
// run_command's listed gate is its non-dangerous FLOOR ("gated"); the effective gate is computed
// per-command via modalSandboxActionGate() below.
export const MODAL_SANDBOX_ACTIONS: readonly ModalSandboxActionMeta[] = [
  {
    name: "spawn_container",
    connector: MODAL_SANDBOX_CONNECTOR,
    action: "spawn_container",
    description: "Spin up an ephemeral container for a Project, optionally mounting a GitHub repo.",
    gate: "gated",
  },
  {
    name: "run_command",
    connector: MODAL_SANDBOX_CONNECTOR,
    action: "run_command",
    description: "Run a command (install / build / test) in a container and stream the output back.",
    gate: "gated",
  },
  {
    name: "stop_container",
    connector: MODAL_SANDBOX_CONNECTOR,
    action: "stop_container",
    description: "Tear down a container. No approval — cleanup can only reduce cost.",
    gate: "auto",
  },
  {
    name: "get_container_status",
    connector: MODAL_SANDBOX_CONNECTOR,
    action: "get_container_status",
    description: "Check whether a container is still running. Read-only.",
    gate: "read",
  },
];

const BASE_GATES: Record<ModalSandboxActionName, SandboxGate> = {
  spawn_container: "gated",
  run_command: "gated",
  stop_container: "auto",
  get_container_status: "read",
};

const KNOWN_ACTIONS = new Set<string>(Object.keys(BASE_GATES));

export function isModalSandboxAction(action: string): action is ModalSandboxActionName {
  return KNOWN_ACTIONS.has(action);
}

/**
 * The EFFECTIVE approval gate for a (action, payload). Every action is static EXCEPT run_command,
 * whose gate is computed from the command text — a shell-special / destructive command is
 * `always_gated` (single-approval forever), an ordinary build command is `gated`.
 */
export function modalSandboxActionGate(
  action: ModalSandboxActionName,
  payload: Record<string, unknown>,
): SandboxGate {
  if (action === "run_command") {
    const command = typeof payload.command === "string" ? payload.command : "";
    return runCommandGate(command);
  }
  return BASE_GATES[action];
}
