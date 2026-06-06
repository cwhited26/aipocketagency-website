// containment-guard.ts — ContainmentGuard extended to ACTION paths (PA-ORCH-9).
//
// lib/brain/containment-guard.ts guards READS: which brain files a sub-agent may pull into an
// LLM context. This module is the single source of truth for the symmetric WRITE guard: which
// connector actions a sub-agent may attempt. A run declares its `toolScopes` up-front (in
// pa_sub_agent_runs.tool_scopes + the spec). Before any connector write is staged, the
// (connector, action) pair is checked here. Anything not declared is blocked with a typed
// error that surfaces in the chat as "I tried to do X but it's outside my approved scope"
// (§7 criterion 9) — fail closed, symmetric with the read guard.
//
// tool-use.ts (the approval-gate middleware) imports the scope check from here so there is
// exactly ONE ConnectorScopeError class + one matching rule across the orchestrator.
//
// UI label stays "Privacy zones"; we never surface "ContainmentGuard" to customers.

// A scope grants action rights at one of these granularities:
//   "*"            → every connector + action (owner-blessed full-trust runs only)
//   "gmail"        → every action on the gmail connector (== "gmail:*")
//   "gmail:*"      → every action on gmail
//   "gmail:send"   → only the `send` action on gmail
// Scopes are declared on the plan; the dispatcher never widens them at runtime.

export class ConnectorScopeError extends Error {
  readonly connector: string;
  readonly action: string;
  readonly userMessage: string;

  constructor(connector: string, action: string) {
    const userMessage =
      `I tried to ${action} via ${connector}, but that's outside this run's approved scope. ` +
      `Want me to ask for the ${connector} scope so I can do that?`;
    super(`ConnectorScope: ${connector}:${action} not in declared scopes`);
    this.name = "ConnectorScopeError";
    this.connector = connector;
    this.action = action;
    this.userMessage = userMessage;
  }
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Canonical scope token for a connector action. */
export function scopeToken(connector: string, action: string): string {
  return `${norm(connector)}:${norm(action)}`;
}

/**
 * True iff `connector.action` is permitted by the declared scope set. A scope matches when it
 * is the global wildcard `*`, the bare connector name or `connector:*` (grants all that
 * connector's actions), or the exact `connector:action` pair. Empty/whitespace scopes never
 * match. Case-insensitive. Fail closed.
 */
export function isActionAllowed(
  connector: string,
  action: string,
  declaredScopes: readonly string[],
): boolean {
  const c = norm(connector);
  const a = norm(action);
  if (!c || !a) return false;
  for (const raw of declaredScopes) {
    const scope = norm(raw);
    if (!scope) continue;
    if (scope === "*") return true;
    if (scope === c) return true;
    if (scope === `${c}:*`) return true;
    if (scope === `${c}:${a}`) return true;
  }
  return false;
}

/**
 * Throws ConnectorScopeError when `connector.action` is outside the declared scopes. Returns
 * void when permitted. Call this BEFORE staging any connector write — the gate is structural,
 * upstream of the approval gate, so an out-of-scope action never even reaches the Inbox.
 */
export function assertActionAllowed(
  connector: string,
  action: string,
  declaredScopes: readonly string[],
): void {
  if (!isActionAllowed(connector, action, declaredScopes)) {
    throw new ConnectorScopeError(connector, action);
  }
}

/**
 * Filters a batch of (connector, action) pairs into allowed + blocked. Never throws — for
 * planning-time validation where one out-of-scope action should be surfaced, not abort the
 * whole plan.
 */
export function partitionAllowedActions(
  pairs: readonly { connector: string; action: string }[],
  declaredScopes: readonly string[],
): {
  allowed: { connector: string; action: string }[];
  blocked: { connector: string; action: string }[];
} {
  const allowed: { connector: string; action: string }[] = [];
  const blocked: { connector: string; action: string }[] = [];
  for (const p of pairs) {
    if (isActionAllowed(p.connector, p.action, declaredScopes)) allowed.push(p);
    else blocked.push(p);
  }
  return { allowed, blocked };
}
