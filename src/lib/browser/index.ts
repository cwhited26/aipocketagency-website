// index.ts — public surface of the Browser Automation lane (Phase 1, Basic mode / hidden browser).

export { BROWSER_CONNECTOR, BROWSER_TOOLS, listBrowserTools, type BrowserToolDefinition } from "./registry";
export { stageBrowserToolCall, type StageBrowserToolResult, type StageBrowserToolInput } from "./stage";
export { executeBrowserAction, type BrowserExecuteResult } from "./execute";
export { BROWSER_TOOL_NAMES, isBrowserToolName, type BrowserToolName } from "./types";
export { BROWSER_ACTION_APPROVAL_KIND, BROWSER_COST_FEATURE_SLUG, type BrowserActionStatus } from "./constants";
export { evaluateRefuse, isForbiddenDomain, matchMoneyMovement } from "./refuse-list";
export {
  resolveDomainDecision,
  canUnlockAutoApprove,
  approvalsUntilUnlock,
  TRUST_LADDER_THRESHOLD,
  type DomainPermission,
  type DomainDecision,
} from "./trust-ladder";
export { evaluateBrowserActionCap, browserActionCap, BROWSER_ACTION_CAPS } from "./tier";
export { domainOf, hostOf, registrableDomain } from "./domains";
