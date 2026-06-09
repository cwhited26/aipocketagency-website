// connectors/modal-sandbox/client.ts — the direct-REST bridge from the PA web tier (Node) to the
// Modal app's `/sandbox/*` endpoints (Build Tools Roadmap §7.4). No Modal SDK in the Node tier —
// symmetric with every other connector's "direct fetch only" rule — and no new runtime: this
// reuses the Wave B Modal app `pa-orchestrator-runtime` and its platform credentials.
//
// Auth: Modal proxy-auth headers (Modal-Key / Modal-Secret), exactly as runtime-client.ts sends
// to the orchestrator's dispatch/cancel/approval endpoints. The base URL is the deployed sandbox
// ASGI app; it is read from PA_SANDBOX_RUNTIME_URL, or derived from the orchestrator runtime URL
// when that env isn't set explicitly (the two endpoints live in the same Modal app, differing
// only by the function suffix), so the common case needs zero new configuration.

export type SandboxRuntimeConfig = {
  url: string;
  tokenId: string;
  tokenSecret: string;
};

/**
 * Derive the sandbox ASGI base URL from the orchestrator dispatch URL. Modal web URLs are
 * `https://<workspace>--<app>-<function>.modal.run`; the orchestrator dispatch endpoint ends in
 * `-dispatch.modal.run` and the sandbox ASGI app ends in `-sandbox-api.modal.run`, so swapping the
 * function suffix yields the sandbox base. Returns null when the input isn't a recognizable Modal
 * dispatch URL (then an explicit PA_SANDBOX_RUNTIME_URL is required).
 */
export function deriveSandboxUrl(orchestratorUrl: string | undefined): string | null {
  if (!orchestratorUrl) return null;
  const trimmed = orchestratorUrl.replace(/\/$/, "");
  const marker = "-dispatch.modal.run";
  if (!trimmed.endsWith(marker)) return null;
  return `${trimmed.slice(0, -marker.length)}-sandbox-api.modal.run`;
}

/** Reads the Modal sandbox config from env, or null when any required value is missing. */
export function sandboxRuntimeConfig(): SandboxRuntimeConfig | null {
  const tokenId = process.env.MODAL_TOKEN_ID;
  const tokenSecret = process.env.MODAL_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) return null;

  const url =
    process.env.PA_SANDBOX_RUNTIME_URL ?? deriveSandboxUrl(process.env.PA_ORCHESTRATOR_RUNTIME_URL);
  if (!url) return null;

  return { url: url.replace(/\/$/, ""), tokenId, tokenSecret };
}

/** True iff the sandbox runtime is wired (creds + a resolvable base URL). Drives the card status. */
export function isSandboxRuntimeConfigured(): boolean {
  return sandboxRuntimeConfig() !== null;
}

export type SandboxCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

/**
 * POST a JSON body to a `/sandbox/*` endpoint and return the typed JSON response. Every failure is
 * a typed result (never a throw, never a silent catch): an unconfigured runtime is 503, a non-2xx
 * carries the upstream status + a truncated body, and an unreadable response is 502.
 */
export async function callSandbox<T>(
  path: `/sandbox/${string}`,
  body: Record<string, unknown>,
): Promise<SandboxCallResult<T>> {
  const cfg = sandboxRuntimeConfig();
  if (!cfg) {
    return {
      ok: false,
      status: 503,
      error:
        "Code execution isn't wired for this workspace yet — deploy the Modal sandbox runtime and " +
        "set PA_SANDBOX_RUNTIME_URL (or PA_ORCHESTRATOR_RUNTIME_URL).",
    };
  }

  let res: Response;
  try {
    res = await fetch(`${cfg.url}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Modal-Key": cfg.tokenId,
        "Modal-Secret": cfg.tokenSecret,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "Sandbox request failed" };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: `Sandbox ${res.status}: ${text.slice(0, 300)}` };
  }

  const data = (await res.json().catch(() => null)) as T | null;
  if (data === null) {
    return { ok: false, status: 502, error: "Sandbox returned an unreadable response." };
  }
  return { ok: true, data };
}
