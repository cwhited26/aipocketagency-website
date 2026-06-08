// connectors/stripe/index.ts — the Stripe Connect connector entry point.
//
// Exposes the action registry + per-action approval gate (for the middleware + UI), the
// auto-approve eligibility policy (refund_charge is hard-excluded), and executeStripeAction —
// the in-process executor the approval route calls via lib/connectors/registry.ts the moment the
// owner approves a staged write (and that the read endpoint calls directly for reads).
//
// This connector acts on the OWNER's connected Stripe account (provider='stripe_connect'), never
// PA's platform Stripe. Connected-account context is the Stripe-Account header (./api.ts);
// auth is the platform secret key. Idempotency keys are derived deterministically from
// (subAgentRunId + connector + action + payload hash) per roadmap §3.2 so a retry of the same
// approved action never double-charges, double-invoices, or double-refunds — no random/clock seed.

import { createHash } from "node:crypto";
import {
  countRecentConnectorActions,
  logConnectorAction,
  OrchestratorDbError,
} from "@/lib/orchestrator/db";
import { fetchStripeConnectionFull, markStripeConnectionError } from "@/lib/pa-stripe-connections";
import { platformSecretKey, notifyStripeReauthNeeded } from "./oauth";
import type { StripeCallContext } from "./api";
import type {
  ActionExecOutcome,
  ApprovalGate,
  StripeActionMeta,
  StripeActionName,
} from "./types";

import { listCustomersAction, ListCustomersInputSchema } from "./actions/list_customers";
import { listInvoicesAction, ListInvoicesInputSchema } from "./actions/list_invoices";
import { getBalanceAction, GetBalanceInputSchema } from "./actions/get_balance";
import { createInvoiceAction, CreateInvoiceInputSchema } from "./actions/create_invoice";
import {
  createPaymentLinkAction,
  CreatePaymentLinkInputSchema,
} from "./actions/create_payment_link";
import { refundChargeAction, RefundChargeInputSchema } from "./actions/refund_charge";

export const STRIPE_CONNECTOR = "stripe";

// ── Action registry (meta only — safe to surface in the UI / scope lists) ──────────────────
export const STRIPE_ACTIONS: readonly StripeActionMeta[] = [
  listCustomersAction,
  listInvoicesAction,
  getBalanceAction,
  createInvoiceAction,
  createPaymentLinkAction,
  refundChargeAction,
].map((a) => ({
  name: a.name,
  connector: STRIPE_CONNECTOR,
  action: a.action,
  description: a.description,
  gate: a.gate,
}));

const GATES: Record<StripeActionName, ApprovalGate> = {
  list_customers: listCustomersAction.gate,
  list_invoices: listInvoicesAction.gate,
  get_balance: getBalanceAction.gate,
  create_invoice: createInvoiceAction.gate,
  create_payment_link: createPaymentLinkAction.gate,
  refund_charge: refundChargeAction.gate,
};

const KNOWN_ACTIONS = new Set<string>(Object.keys(GATES));

export function isStripeAction(action: string): action is StripeActionName {
  return KNOWN_ACTIONS.has(action);
}

export function stripeActionGate(action: StripeActionName): ApprovalGate {
  return GATES[action];
}

/** Read-only actions bypass the approval Inbox entirely. */
export function isStripeReadOnly(action: StripeActionName): boolean {
  return GATES[action] === "read";
}

/** Mutating (write) actions — what the per-minute cap + gating key on. */
export const STRIPE_WRITE_ACTIONS: readonly StripeActionName[] = (
  Object.keys(GATES) as StripeActionName[]
).filter((a) => GATES[a] !== "read");

/**
 * Actions that can NEVER become auto-approve eligible, regardless of how many were manually
 * approved (gate === "always_gated"). refund_charge is the canonical case: refunds move real
 * money OUT and are the prime prompt-injection target (roadmap §2.4), so there is no trust
 * window that ever unlocks them. The auto-approve toggle route consults this to refuse enabling
 * such an action, and runStripeAction never increments their trust count — double enforcement.
 */
export function isStripeNeverAutoApprove(action: StripeActionName): boolean {
  return GATES[action] === "always_gated";
}

/**
 * True iff the action is auto-approve eligible WITHOUT clearing the trust window (reads only).
 * Gated writes earn auto-approve only after the PA-ORCH-4 trust window; always_gated (refund)
 * never does.
 */
export function isStripeAutoApproveEligibleByDefault(action: StripeActionName): boolean {
  return GATES[action] === "read";
}

// ── Idempotency seed (roadmap §3.2) ────────────────────────────────────────────────────────

function deriveIdempotencyKey(
  subAgentRunId: string | null,
  action: StripeActionName,
  payload: Record<string, unknown>,
): string {
  const payloadHash = createHash("sha256").update(JSON.stringify(payload ?? {})).digest("hex");
  return createHash("sha256")
    .update(`${subAgentRunId ?? ""}:${STRIPE_CONNECTOR}:${action}:${payloadHash}`)
    .digest("hex");
}

// ── Execute against the Stripe API (payload validated per-action) ───────────────────────────

function badPayload(message: string): ActionExecOutcome {
  return { ok: false, status: 422, error: message, authError: false };
}

/**
 * Validate `payload` with the action's schema and run it against the connected account. Pure
 * dispatch: resolves the typed input, runs the action, and normalizes to ActionExecOutcome.
 * `idempotencyKey` seeds the mutating actions; reads ignore it.
 */
async function executeStripeActionCore(
  action: StripeActionName,
  args: { ctx: StripeCallContext; payload: Record<string, unknown>; idempotencyKey: string },
): Promise<ActionExecOutcome> {
  switch (action) {
    case "list_customers": {
      const parsed = ListCustomersInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await listCustomersAction.execute({ ctx: args.ctx, input: parsed.data });
      return r.ok ? { ok: true, ...r.data } : r;
    }
    case "list_invoices": {
      const parsed = ListInvoicesInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await listInvoicesAction.execute({ ctx: args.ctx, input: parsed.data });
      return r.ok ? { ok: true, ...r.data } : r;
    }
    case "get_balance": {
      const parsed = GetBalanceInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await getBalanceAction.execute({ ctx: args.ctx, input: parsed.data });
      return r.ok ? { ok: true, ...r.data } : r;
    }
    case "create_invoice": {
      const parsed = CreateInvoiceInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await createInvoiceAction.execute({
        ctx: args.ctx,
        input: parsed.data,
        idempotencyKey: args.idempotencyKey,
      });
      return r.ok ? { ok: true, ...r.data } : r;
    }
    case "create_payment_link": {
      const parsed = CreatePaymentLinkInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await createPaymentLinkAction.execute({
        ctx: args.ctx,
        input: parsed.data,
        idempotencyKey: args.idempotencyKey,
      });
      return r.ok ? { ok: true, ...r.data } : r;
    }
    case "refund_charge": {
      const parsed = RefundChargeInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await refundChargeAction.execute({
        ctx: args.ctx,
        input: parsed.data,
        idempotencyKey: args.idempotencyKey,
      });
      return r.ok ? { ok: true, ...r.data } : r;
    }
    default: {
      // Exhaustiveness: every StripeActionName is handled above.
      const _never: never = action;
      return badPayload(`Unknown stripe action: ${String(_never)}`);
    }
  }
}

// ── High-level: resolve the connection + platform key, then execute ─────────────────────────

export type StripeExecuteResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export type RunStripeActionInput = {
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  subAgentRunId?: string | null;
  /** Owner email for the re-auth nudge on a hard auth failure (best-effort). */
  ownerEmail?: string | null;
};

// Per-user-per-minute write cap (roadmap abuse note — money actions are the sharpest edge).
const DEFAULT_MAX_WRITES_PER_MIN = 10;

export function stripeMaxWritesPerMin(): number {
  const raw = process.env.PA_STRIPE_MAX_WRITES_PER_MIN;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_WRITES_PER_MIN;
  return n;
}

/** Pure: is a new write blocked given how many writes already fired in the window? */
export function rateCapExceeded(recentWrites: number, cap: number): boolean {
  return recentWrites >= cap;
}

/**
 * Execute one Stripe action for an owner. Used by the approval route on approve (writes — via the
 * registry) and by the read endpoint (reads). Resolves the connected account + platform key,
 * derives the idempotency seed, runs the action, and audit-logs mutating outcomes. A hard auth
 * failure flips the connection to status='error' and fires the re-auth email (roadmap §3.5).
 *
 * NOTE: this never increments any trust-window count — refund_charge in particular must never
 * accrue auto-approve trust. Trust accounting lives in the approve route, which is correct for
 * gated writes; refund_charge is excluded there too (isStripeNeverAutoApprove).
 */
export async function executeStripeAction(
  input: RunStripeActionInput,
): Promise<StripeExecuteResult> {
  if (!isStripeAction(input.action)) {
    return { ok: false, status: 400, error: `Unknown Stripe action: ${input.action}` };
  }
  const action = input.action;

  const secretKey = platformSecretKey();
  if (!secretKey) {
    return {
      ok: false,
      status: 503,
      error: "Stripe isn't configured for this workspace — enable Stripe Connect in the Stripe Dashboard.",
    };
  }

  const conn = await fetchStripeConnectionFull(input.userId);
  if (!conn.ok) return { ok: false, status: conn.status, error: conn.error };
  if (!conn.data || conn.data.status === "revoked" || !conn.data.stripeAccountId) {
    return {
      ok: false,
      status: 409,
      error: "Connect Stripe in Settings → Connections before running Stripe actions.",
    };
  }

  const mutating = isStripeAction(action) && !isStripeReadOnly(action);

  // Per-minute write cap — checked before the API round-trip so a burst is cheap to reject.
  if (mutating) {
    const cap = stripeMaxWritesPerMin();
    const since = new Date(Date.now() - 60_000).toISOString();
    let recent: number;
    try {
      recent = await countRecentConnectorActions({
        businessId: input.userId,
        connector: STRIPE_CONNECTOR,
        status: "executed",
        sinceIso: since,
        actions: STRIPE_WRITE_ACTIONS,
      });
    } catch (e) {
      if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) recent = 0;
      else throw e;
    }
    if (rateCapExceeded(recent, cap)) {
      return {
        ok: false,
        status: 429,
        error: `Stripe write rate cap reached (${cap}/min). Try again in a minute.`,
      };
    }
  }

  const ctx: StripeCallContext = { secretKey, accountId: conn.data.stripeAccountId };
  const idempotencyKey = deriveIdempotencyKey(input.subAgentRunId ?? null, action, input.payload);

  const outcome = await executeStripeActionCore(action, { ctx, payload: input.payload, idempotencyKey });

  if (!outcome.ok) {
    if (mutating) await logExecuted(input, action, "failed", outcome.error);
    if (outcome.authError) {
      await markStripeConnectionError(conn.data.id);
      await notifyStripeReauthNeeded(input.ownerEmail ?? null);
      return {
        ok: false,
        status: 401,
        error: "Stripe disconnected — reconnect Stripe in Settings → Connections.",
      };
    }
    return { ok: false, status: outcome.status, error: outcome.error };
  }

  if (mutating) await logExecuted(input, action, "executed", outcome.summary);
  return { ok: true, summary: outcome.summary, data: outcome.data };
}

// Audit-log the terminal outcome of a write. Best-effort: a missing audit table (migration not
// applied) must not fail an otherwise-successful action. payload_hash is empty here — the staged
// row (written by the middleware) carries the canonical hash; this row records outcome.
async function logExecuted(
  input: RunStripeActionInput,
  action: StripeActionName,
  status: "executed" | "failed",
  summary: string,
): Promise<void> {
  try {
    await logConnectorAction({
      businessId: input.userId,
      subAgentRunId: input.subAgentRunId ?? null,
      connector: STRIPE_CONNECTOR,
      action,
      payloadHash: "",
      status,
      responseSummary: summary.slice(0, 500),
    });
  } catch (e) {
    if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) return;
    throw e;
  }
}
