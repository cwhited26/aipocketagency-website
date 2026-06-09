// connectors/modal-sandbox/types.ts — shared vocabulary for the Modal Sandbox connector
// (Build Tools Roadmap §7.4, PA-BUILD-4).
//
// This connector is PLATFORM infrastructure, not an owner-connected account: it drives the
// Wave B Modal app (`pa-orchestrator-runtime`) using the platform Modal credentials
// (MODAL_TOKEN_ID / MODAL_TOKEN_SECRET), so there is no OAuth and no per-owner token. Every
// container is ephemeral and scoped to one Project's task (PA-BUILD-4): born for a build,
// runs its command, and dies on `stop_container` or its TTL.

export const MODAL_SANDBOX_CONNECTOR = "modal_sandbox";

// The approval gate for a sandbox action (Build Tools Roadmap §9.3):
//   "read"         — read-only; bypasses the Approval Inbox entirely (get_container_status).
//   "auto"         — mutating but un-gated; runs without an approval (stop_container is pure
//                    cleanup — tearing a container down can only ever REDUCE cost/blast-radius,
//                    so there is no reason to make the owner approve a teardown).
//   "gated"        — per-action approval; may graduate to auto-approve after the PA-ORCH-4 trust
//                    window (spawn_container, and run_command for ordinary build commands).
//   "always_gated" — per-action approval that NEVER becomes auto-approve eligible, regardless of
//                    success_count. run_command with a shell-special command (pipes, redirection,
//                    command substitution, curl/wget/eval/rm -rf) is the canonical case: an
//                    arbitrary shell command in a container that can mount the owner's repo is the
//                    prime prompt-injection target (Roadmap §11), so every such command is an
//                    explicit per-action owner tap, forever.
export type SandboxGate = "read" | "auto" | "gated" | "always_gated";

export type ModalSandboxActionName =
  | "spawn_container"
  | "run_command"
  | "stop_container"
  | "get_container_status";

// Listing shape for the UI / scope surfaces (name + base gate, no executable bits). run_command's
// EFFECTIVE gate is computed per-command (see commands.ts) — this base gate is its non-dangerous
// floor.
export type ModalSandboxActionMeta = {
  name: string;
  connector: typeof MODAL_SANDBOX_CONNECTOR;
  action: ModalSandboxActionName;
  description: string;
  gate: SandboxGate;
};

// Uniform outcome of executing an action, so the approve route + read paths handle every action
// the same way without `any`. `summary` is a human one-liner for the audit log + card.
export type SandboxExecOutcome =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

// ── Per-endpoint response shapes the Modal app returns (app.py `/sandbox/*`) ────────────────
export type SpawnContainerResult = {
  container_id: string;
  status: string;
  repo_cloned?: boolean;
  clone_error?: string | null;
};

export type RunCommandResult = {
  stdout: string;
  stderr: string;
  exit_code: number;
  cached: boolean;
};

export type StopContainerResult = {
  stopped: boolean;
  error?: string | null;
};

export type ContainerStatusResult = {
  container_id: string;
  status: string;
  running: boolean;
  returncode?: number | null;
  error?: string | null;
};
