// connectors/modal-sandbox/commands.ts — the run_command danger classifier (Build Tools Roadmap
// §7.4, task item 3). PURE so it is unit-tested in isolation and reused by both the gate resolver
// and the auto-approve eligibility check.
//
// The rule (task item 3, hard requirement): run_command is SINGLE-APPROVAL FOREVER — never
// auto-approve eligible — for any command that contains a shell-special character ( ; && || |
// backticks $( ) , a redirection ( > >> < ), OR matches a high-blast-radius tool (curl, wget,
// eval, rm -rf). A bare `pnpm install` / `pnpm run build` / `pnpm test` / `npm run lint` carries
// no shell metacharacter and matches no dangerous tool, so it follows the ordinary trust window.
//
// This is deliberately conservative: a command is "dangerous" if it COULD chain, exfiltrate, or
// destroy, even when the specific instance looks benign. Better to ask the owner one extra time
// than to auto-fire a shell that can reach their repo + network.

import type { SandboxGate } from "./types";

// Shell-special sequences that allow command chaining, piping, substitution, or redirection.
// Any of these in a command means it is more than a single program invocation.
const SHELL_SPECIAL: readonly string[] = [
  ";", // statement separator
  "&&", // and-chain
  "||", // or-chain
  "|", // pipe
  "`", // backtick command substitution
  "$(", // $() command substitution
  ">", // redirect out (covers >>)
  "<", // redirect in
  "&", // background / fd duplication
];

// High-blast-radius tools that fetch from the network or destroy the filesystem. Matched as
// whole words (so `curl` matches but `mycurltool` does not).
const DANGEROUS_TOOLS: readonly RegExp[] = [
  /\bcurl\b/i,
  /\bwget\b/i,
  /\beval\b/i,
  /\brm\s+-rf\b/i,
  /\brm\s+-fr\b/i,
];

/**
 * Pure: does this command require single-approval-forever (never auto-approve)? True iff it
 * contains any shell-special sequence or matches a high-blast-radius tool.
 */
export function isDangerousCommand(command: string): boolean {
  const cmd = command ?? "";
  if (SHELL_SPECIAL.some((token) => cmd.includes(token))) return true;
  if (DANGEROUS_TOOLS.some((re) => re.test(cmd))) return true;
  return false;
}

/**
 * The EFFECTIVE approval gate for a run_command, computed from the command text: a dangerous
 * command is `always_gated` (never auto-approves); an ordinary build command is `gated` (earns
 * auto-approve only after the PA-ORCH-4 trust window).
 */
export function runCommandGate(command: string): SandboxGate {
  return isDangerousCommand(command) ? "always_gated" : "gated";
}

/** Human one-liner explaining WHY a command is held for explicit approval (for the Inbox card). */
export function dangerReason(command: string): string | null {
  if (!isDangerousCommand(command)) return null;
  return (
    "This command uses shell features (pipes, chaining, redirection, or a network/destructive " +
    "tool), so it stays single-approval — Pocket Agent will never run a command like this on its " +
    "own, no matter how many you've approved before."
  );
}
