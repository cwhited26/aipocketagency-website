// connectors/quickbooks/api.ts — QuickBooks Online API v3 REST client (direct fetch, no SDK).
// Every response is validated with Zod at the boundary. The action modules build the request
// bodies (pure) and call these; only these functions touch the network.
//
// All paths are /v3/company/<realmId>/… on the environment host (quickBooksApiBase). minorversion
// pins the schema so a server-side field change can't silently shift a response shape.

import { z } from "zod";
import { quickBooksApiBase } from "./oauth";
import type { QuickBooksResult } from "./types";

const MINOR_VERSION = "70";

function isAuthFailure(status: number, body: string): boolean {
  return status === 401 || status === 403 || body.includes("AuthenticationFailed");
}

function companyPath(realmId: string, suffix: string): string {
  return `${quickBooksApiBase()}/v3/company/${encodeURIComponent(realmId)}/${suffix}`;
}

async function parseJson<T>(res: Response, schema: z.ZodType<T>): Promise<QuickBooksResult<T>> {
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: quickBooksErrorMessage(text),
      authError: isAuthFailure(res.status, text),
    };
  }
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, status: 502, error: "QuickBooks returned non-JSON", authError: false };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, error: "QuickBooks response shape invalid", authError: false };
  }
  return { ok: true, data: parsed.data };
}

// QBO wraps errors as { Fault: { Error: [{ Message, Detail }] } }. Surface the first detail so
// the owner sees "Invalid Reference Id" rather than a raw blob — never a silent swallow.
function quickBooksErrorMessage(body: string): string {
  try {
    const raw = JSON.parse(body) as {
      Fault?: { Error?: { Message?: string; Detail?: string }[] };
    };
    const first = raw.Fault?.Error?.[0];
    if (first) return first.Detail ?? first.Message ?? body.slice(0, 300);
  } catch {
    // Non-JSON error body — fall through to the raw slice.
  }
  return body.slice(0, 300);
}

// ─── query (read) ───────────────────────────────────────────────────────────────
// The QBO query endpoint runs a read-only SQL-like statement and returns matching entities under
// QueryResponse. Customers and Invoices share the endpoint; the caller passes the statement.

const CustomerSchema = z.object({
  Id: z.string(),
  DisplayName: z.string().optional(),
  CompanyName: z.string().optional(),
  PrimaryEmailAddr: z.object({ Address: z.string().optional() }).optional(),
  Balance: z.number().optional(),
  Active: z.boolean().optional(),
});
export type QuickBooksCustomer = z.infer<typeof CustomerSchema>;

const InvoiceSchema = z.object({
  Id: z.string(),
  DocNumber: z.string().optional(),
  TxnDate: z.string().optional(),
  DueDate: z.string().optional(),
  TotalAmt: z.number().optional(),
  Balance: z.number().optional(),
  CustomerRef: z.object({ value: z.string(), name: z.string().optional() }).optional(),
});
export type QuickBooksInvoice = z.infer<typeof InvoiceSchema>;

const CustomerQueryResponseSchema = z.object({
  QueryResponse: z
    .object({ Customer: z.array(CustomerSchema).optional() })
    .optional(),
});

const InvoiceQueryResponseSchema = z.object({
  QueryResponse: z
    .object({ Invoice: z.array(InvoiceSchema).optional() })
    .optional(),
});

async function runQuery<T>(
  accessToken: string,
  realmId: string,
  statement: string,
  schema: z.ZodType<T>,
): Promise<QuickBooksResult<T>> {
  const url = new URL(companyPath(realmId, "query"));
  url.searchParams.set("query", statement);
  url.searchParams.set("minorversion", MINOR_VERSION);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  return parseJson(res, schema);
}

export async function queryCustomers(
  accessToken: string,
  realmId: string,
  statement: string,
): Promise<QuickBooksResult<QuickBooksCustomer[]>> {
  const r = await runQuery(accessToken, realmId, statement, CustomerQueryResponseSchema);
  if (!r.ok) return r;
  return { ok: true, data: r.data.QueryResponse?.Customer ?? [] };
}

export async function queryInvoices(
  accessToken: string,
  realmId: string,
  statement: string,
): Promise<QuickBooksResult<QuickBooksInvoice[]>> {
  const r = await runQuery(accessToken, realmId, statement, InvoiceQueryResponseSchema);
  if (!r.ok) return r;
  return { ok: true, data: r.data.QueryResponse?.Invoice ?? [] };
}

// ─── Profit & Loss report (read) ─────────────────────────────────────────────────
// The Reports API returns a nested Header/Columns/Rows tree. We keep the validated shape loose
// (the report structure varies by accounting method) and project a flat summary in the action.

const ReportColDataSchema = z.object({ value: z.string().optional() });
type ReportRow = {
  Header?: { ColData?: { value?: string }[] };
  ColData?: { value?: string }[];
  Summary?: { ColData?: { value?: string }[] };
  Rows?: { Row?: ReportRow[] };
  group?: string;
};
const ReportRowSchema: z.ZodType<ReportRow> = z.lazy(() =>
  z.object({
    Header: z.object({ ColData: z.array(ReportColDataSchema).optional() }).optional(),
    ColData: z.array(ReportColDataSchema).optional(),
    Summary: z.object({ ColData: z.array(ReportColDataSchema).optional() }).optional(),
    Rows: z.object({ Row: z.array(ReportRowSchema).optional() }).optional(),
    group: z.string().optional(),
  }),
);

const ProfitAndLossSchema = z.object({
  Header: z
    .object({
      ReportName: z.string().optional(),
      StartPeriod: z.string().optional(),
      EndPeriod: z.string().optional(),
      Currency: z.string().optional(),
    })
    .optional(),
  Columns: z
    .object({ Column: z.array(z.object({ ColTitle: z.string().optional() })).optional() })
    .optional(),
  Rows: z.object({ Row: z.array(ReportRowSchema).optional() }).optional(),
});
export type ProfitAndLossReport = z.infer<typeof ProfitAndLossSchema>;

export async function fetchProfitAndLoss(
  accessToken: string,
  realmId: string,
  params: { startDate?: string; endDate?: string; accountingMethod?: string },
): Promise<QuickBooksResult<ProfitAndLossReport>> {
  const url = new URL(companyPath(realmId, "reports/ProfitAndLoss"));
  if (params.startDate) url.searchParams.set("start_date", params.startDate);
  if (params.endDate) url.searchParams.set("end_date", params.endDate);
  if (params.accountingMethod) url.searchParams.set("accounting_method", params.accountingMethod);
  url.searchParams.set("minorversion", MINOR_VERSION);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  return parseJson(res, ProfitAndLossSchema);
}

// ─── Invoice (write) ──────────────────────────────────────────────────────────────

// The subset of the Invoice resource the connector writes. ItemRef is optional per line so the
// drafter can stage description-only lines; QBO validates the rest server-side.
export type InvoiceLineBody = {
  Amount: number;
  DetailType: "SalesItemLineDetail";
  Description?: string;
  SalesItemLineDetail: {
    ItemRef?: { value: string };
    Qty?: number;
    UnitPrice?: number;
  };
};

export type InvoiceWriteBody = {
  CustomerRef: { value: string };
  Line: InvoiceLineBody[];
  DueDate?: string;
  CustomerMemo?: { value: string };
};

const CreatedInvoiceSchema = z.object({
  Invoice: z.object({
    Id: z.string(),
    DocNumber: z.string().optional(),
    TotalAmt: z.number().optional(),
    Balance: z.number().optional(),
    DueDate: z.string().optional(),
  }),
});

export async function createInvoice(
  accessToken: string,
  realmId: string,
  body: InvoiceWriteBody,
  requestId: string,
): Promise<QuickBooksResult<{ id: string; docNumber: string | null; totalAmt: number | null }>> {
  const url = new URL(companyPath(realmId, "invoice"));
  url.searchParams.set("minorversion", MINOR_VERSION);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      // Intuit idempotency: a retried POST with the same Request-Id returns the original result
      // instead of creating a duplicate invoice (roadmap §2.3 — mandatory for financial writes).
      "Request-Id": requestId,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const parsed = await parseJson(res, CreatedInvoiceSchema);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    data: {
      id: parsed.data.Invoice.Id,
      docNumber: parsed.data.Invoice.DocNumber ?? null,
      totalAmt: parsed.data.Invoice.TotalAmt ?? null,
    },
  };
}

// ─── Payment (write) ────────────────────────────────────────────────────────────

export type PaymentWriteBody = {
  TotalAmt: number;
  CustomerRef: { value: string };
  Line: {
    Amount: number;
    LinkedTxn: { TxnId: string; TxnType: "Invoice" }[];
  }[];
};

const CreatedPaymentSchema = z.object({
  Payment: z.object({
    Id: z.string(),
    TotalAmt: z.number().optional(),
  }),
});

export async function createPayment(
  accessToken: string,
  realmId: string,
  body: PaymentWriteBody,
  requestId: string,
): Promise<QuickBooksResult<{ id: string; totalAmt: number | null }>> {
  const url = new URL(companyPath(realmId, "payment"));
  url.searchParams.set("minorversion", MINOR_VERSION);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Request-Id": requestId,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const parsed = await parseJson(res, CreatedPaymentSchema);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    data: { id: parsed.data.Payment.Id, totalAmt: parsed.data.Payment.TotalAmt ?? null },
  };
}
