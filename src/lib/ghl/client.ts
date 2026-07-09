// client.ts — the one fetch path every GHL API call rides (SPEC §5.6 cost discipline). Direct
// REST, Zod-validated by the caller via `schema`, and one pa_cost_events row per call:
// backend 'ghl', cost 0 micro-cents (the agency's own GHL plan covers the API), metadata
// carrying endpoint / location / outcome / latency for tier enforcement + observability.

import type { z } from "zod";
import { logCostEvent } from "@/lib/cost/log";
import { ghlApiBase } from "./config";

export type GhlApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

export type GhlApiCallInput = {
  /** Path under the API base, e.g. "/contacts/search". */
  path: string;
  method: "GET" | "POST";
  /** Bearer token — agency token for /locations, a minted Location token for per-client calls. */
  accessToken: string;
  /** The API-family Version header (config.ts constants). */
  version: string;
  query?: Record<string, string>;
  body?: unknown;
  /** Cost-ledger attribution. */
  ownerId: string;
  /** Deterministic per-call key so a retry collapses to one ledger row. */
  idempotencyKey: string;
  /** The client sub-account this call touches; "" for agency-level calls. */
  locationId: string;
  /** Rented vs tier-included usage (PA-POS-31). Omit = 'tier'. */
  entitlementSource?: "tier" | "project_pass" | "top_up";
};

function isAuthFailure(status: number): boolean {
  return status === 401 || status === 403;
}

/**
 * Fire one GHL API call, validate the response body against `schema`, and write the usage row.
 * The ledger write is fire-and-forget by design (logCostEvent never throws); the call result is
 * what the caller acts on.
 */
export async function ghlApiCall<S extends z.ZodTypeAny>(
  input: GhlApiCallInput,
  schema: S,
): Promise<GhlApiResult<z.infer<S>>> {
  const url = new URL(`${ghlApiBase()}${input.path}`);
  for (const [k, v] of Object.entries(input.query ?? {})) url.searchParams.set(k, v);

  const startedAt = Date.now();
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: input.method,
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Version: input.version,
        Accept: "application/json",
        ...(input.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    await logGhlUsage(input, "network_error", Date.now() - startedAt);
    return {
      ok: false,
      status: 502,
      error: e instanceof Error ? e.message : "network error",
      authError: false,
    };
  }

  const latencyMs = Date.now() - startedAt;
  const text = await res.text();
  if (!res.ok) {
    await logGhlUsage(input, `http_${res.status}`, latencyMs);
    return { ok: false, status: res.status, error: text, authError: isAuthFailure(res.status) };
  }

  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    await logGhlUsage(input, "non_json", latencyMs);
    return { ok: false, status: 502, error: "GHL returned non-JSON", authError: false };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    await logGhlUsage(input, "shape_invalid", latencyMs);
    return {
      ok: false,
      status: 502,
      error: `GHL response shape invalid at ${input.path}`,
      authError: false,
    };
  }

  await logGhlUsage(input, "ok", latencyMs);
  return { ok: true, data: parsed.data };
}

async function logGhlUsage(
  input: GhlApiCallInput,
  outcome: string,
  latencyMs: number,
): Promise<void> {
  await logCostEvent({
    ownerId: input.ownerId,
    featureSlug: "ghl_connector",
    backend: "ghl",
    costMicroCents: 0,
    idempotencyKey: input.idempotencyKey,
    entitlementSource: input.entitlementSource,
    metadata: {
      endpoint: input.path,
      location_id: input.locationId,
      outcome,
      latency_ms: String(latencyMs),
    },
  });
}
