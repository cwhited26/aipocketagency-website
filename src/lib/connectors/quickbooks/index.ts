// connectors/quickbooks/index.ts — the QuickBooks Online connector entry point.
//
// Exposes the action list + per-action approval gate (for the approval middleware and UI), and
// the TS executor that performs an action against the QuickBooks Online API v3. QuickBooks is an
// IN-PROCESS connector (TypeScript + direct REST, like Slack): a write fires here in the Next
// runtime the moment the owner approves — no Modal sub-agent makes the QBO call.
//
// Per the Wave B contract, a sub-agent never calls Intuit directly: it stages the action via the
// approval middleware (lib/orchestrator/tool-use.ts → stageConnectorAction), which scope-checks
// it (ContainmentGuard) and writes the Inbox + approval + audit rows. The staged action fires
// when the owner approves and executeQuickBooksConnectorAction (execute.ts) runs.

import {
  fetchQuickBooksConnectionFull,
  markQuickBooksConnectionError,
} from "@/lib/pa-quickbooks-connections";
import { ensureFreshQuickBooksToken, hasAccountingScope } from "./oauth";
import type {
  ActionExecOutcome,
  ApprovalGate,
  QuickBooksActionMeta,
  QuickBooksActionName,
} from "./types";

import { listCustomersAction, ListCustomersInputSchema } from "./actions/list_customers";
import { listInvoicesAction, ListInvoicesInputSchema } from "./actions/list_invoices";
import { runPlReportAction, RunPlReportInputSchema } from "./actions/run_pl_report";
import { createInvoiceAction, CreateInvoiceInputSchema } from "./actions/create_invoice";
import { recordPaymentAction, RecordPaymentInputSchema } from "./actions/record_payment";
import { formatMoney } from "./format";

export const CONNECTOR = "quickbooks" as const;

// ── Action registry (meta only — safe to surface in the UI / scope lists) ──────────────────
export const QUICKBOOKS_ACTIONS: readonly QuickBooksActionMeta[] = [
  listCustomersAction,
  listInvoicesAction,
  runPlReportAction,
  createInvoiceAction,
  recordPaymentAction,
].map((a) => ({
  name: a.name,
  connector: CONNECTOR,
  action: a.action,
  description: a.description,
  gate: a.gate,
}));

const GATES: Record<QuickBooksActionName, ApprovalGate> = {
  list_customers: listCustomersAction.gate,
  list_invoices: listInvoicesAction.gate,
  run_pl_report: runPlReportAction.gate,
  create_invoice: createInvoiceAction.gate,
  record_payment: recordPaymentAction.gate,
};

const KNOWN_ACTIONS = new Set<string>(Object.keys(GATES));

export function isQuickBooksAction(action: string): action is QuickBooksActionName {
  return KNOWN_ACTIONS.has(action);
}

export function quickBooksActionGate(action: QuickBooksActionName): ApprovalGate {
  return GATES[action];
}

/** Read-only actions bypass the approval Inbox entirely. */
export function isQuickBooksReadOnly(action: QuickBooksActionName): boolean {
  return GATES[action] === "read";
}

/** Write actions (approval-gated) — the names the gating + trust-ladder logic key on. */
export const QUICKBOOKS_WRITE_ACTIONS: readonly QuickBooksActionName[] = (
  Object.keys(GATES) as QuickBooksActionName[]
).filter((a) => GATES[a] === "gated");

// ── Execute against the QBO API (payload validated per-action) ─────────────────────────────

function badPayload(message: string): ActionExecOutcome {
  return { ok: false, status: 422, error: message, authError: false };
}

/**
 * Validate `payload` with the action's schema and run it. `requestId` is the idempotency seed
 * for the financial writes (Request-Id header) — derive it deterministically from the approval
 * id so a retry/crash-resume never double-posts.
 */
export async function executeQuickBooksAction(
  action: QuickBooksActionName,
  args: { accessToken: string; realmId: string; payload: Record<string, unknown>; requestId: string },
): Promise<ActionExecOutcome> {
  switch (action) {
    case "list_customers": {
      const parsed = ListCustomersInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await listCustomersAction.execute({
        accessToken: args.accessToken,
        realmId: args.realmId,
        input: parsed.data,
      });
      if (!r.ok) return r;
      return {
        ok: true,
        summary: `Found ${r.data.customers.length} customer(s).`,
        data: { customers: r.data.customers },
      };
    }
    case "list_invoices": {
      const parsed = ListInvoicesInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await listInvoicesAction.execute({
        accessToken: args.accessToken,
        realmId: args.realmId,
        input: parsed.data,
      });
      if (!r.ok) return r;
      return {
        ok: true,
        summary: `Found ${r.data.invoices.length} invoice(s).`,
        data: { invoices: r.data.invoices },
      };
    }
    case "run_pl_report": {
      const parsed = RunPlReportInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await runPlReportAction.execute({
        accessToken: args.accessToken,
        realmId: args.realmId,
        input: parsed.data,
      });
      if (!r.ok) return r;
      const net = r.data.summary.netIncome;
      return {
        ok: true,
        summary:
          net === null
            ? "Profit & Loss report ready."
            : `Profit & Loss ready — net income ${formatMoney(net)}.`,
        data: { summary: r.data.summary },
      };
    }
    case "create_invoice": {
      const parsed = CreateInvoiceInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await createInvoiceAction.execute({
        accessToken: args.accessToken,
        realmId: args.realmId,
        input: parsed.data,
        requestId: args.requestId,
      });
      if (!r.ok) return r;
      return {
        ok: true,
        summary:
          `Created invoice ${r.data.docNumber ?? r.data.invoiceId}` +
          `${r.data.total !== null ? ` for ${formatMoney(r.data.total)}` : ""}.`,
        data: { invoiceId: r.data.invoiceId, docNumber: r.data.docNumber, total: r.data.total },
      };
    }
    case "record_payment": {
      const parsed = RecordPaymentInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await recordPaymentAction.execute({
        accessToken: args.accessToken,
        realmId: args.realmId,
        input: parsed.data,
        requestId: args.requestId,
      });
      if (!r.ok) return r;
      return {
        ok: true,
        summary:
          `Recorded payment ${r.data.paymentId}` +
          `${r.data.amount !== null ? ` of ${formatMoney(r.data.amount)}` : ""}.`,
        data: { paymentId: r.data.paymentId, amount: r.data.amount },
      };
    }
    default: {
      // Exhaustiveness: every QuickBooksActionName is handled above.
      const _never: never = action;
      return badPayload(`Unknown QuickBooks action: ${String(_never)}`);
    }
  }
}

// ── High-level: resolve the connection + token + realm, then execute ────────────────────────

export type RunQuickBooksResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; reauth: boolean };

/**
 * Resolve the owner's QuickBooks connection, ensure a fresh access token (refreshing + flipping
 * to reauth on failure), then execute the action. `reauth:true` signals the caller to surface
 * the reconnect path (a dead grant, missing connection, missing realm, or missing scope).
 * `ownerEmail` is the OWNER's email for the high-priority re-auth nudge (the connection's `email`
 * column holds the company name, not a contact address).
 */
export async function runQuickBooksAction(input: {
  userId: string;
  action: QuickBooksActionName;
  payload: Record<string, unknown>;
  requestId: string;
  ownerEmail: string | null;
}): Promise<RunQuickBooksResult> {
  const conn = await fetchQuickBooksConnectionFull(input.userId);
  if (!conn.ok) return { ok: false, status: conn.status, error: conn.error, reauth: false };
  if (!conn.data || conn.data.status === "revoked") {
    return {
      ok: false,
      status: 409,
      error: "Connect QuickBooks in Settings → Connections first.",
      reauth: true,
    };
  }
  if (!conn.data.realmId) {
    return {
      ok: false,
      status: 409,
      error: "QuickBooks connection is missing its company id — reconnect QuickBooks.",
      reauth: true,
    };
  }
  if (!hasAccountingScope(conn.data.scopes)) {
    return {
      ok: false,
      status: 403,
      error:
        "Re-authorize QuickBooks to enable accounting actions — Settings → Connections → Reconnect.",
      reauth: true,
    };
  }

  const token = await ensureFreshQuickBooksToken(conn.data, input.ownerEmail);
  if (!token.ok) {
    return {
      ok: false,
      status: 502,
      error: "QuickBooks authorization expired — reconnect QuickBooks in Settings.",
      reauth: true,
    };
  }

  const outcome = await executeQuickBooksAction(input.action, {
    accessToken: token.data,
    realmId: conn.data.realmId,
    payload: input.payload,
    requestId: input.requestId,
  });
  if (!outcome.ok) {
    if (outcome.authError) {
      await markQuickBooksConnectionError(conn.data.id);
      return { ok: false, status: outcome.status, error: outcome.error, reauth: true };
    }
    return { ok: false, status: outcome.status, error: outcome.error, reauth: false };
  }
  return { ok: true, summary: outcome.summary, data: outcome.data };
}

// Re-export the typed action descriptors for unit tests that exercise the pure functions.
export {
  listCustomersAction,
  listInvoicesAction,
  runPlReportAction,
  createInvoiceAction,
  recordPaymentAction,
};
