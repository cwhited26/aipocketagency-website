// adapter.ts — thin direct-REST wrapper around Browserbase's Sessions API (no SDK, repo rule).
// The Browser Agent App creates one keep-alive session per job, reconnects to it on every cron
// tick over CDP (playwright-core connectOverCDP — same engine the Competitor Inspector already
// ships), and releases it when the job reaches a terminal status.
//
// Env: BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID (platform account — per-workspace override
// tokens would ride PA_CONNECTIONS_ENC_KEY later; not offered yet).

import { BROWSER_VIEWPORT } from "@/lib/browser-agent/constants";

const BROWSERBASE_API = "https://api.browserbase.com/v1";

export type BrowserbaseSession = {
  id: string;
  connectUrl: string;
  status: string;
};

export type BrowserbaseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function env(): { apiKey: string; projectId: string } | { error: string } {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    return { error: "BROWSERBASE_API_KEY / BROWSERBASE_PROJECT_ID not set" };
  }
  return { apiKey, projectId };
}

type SessionApiRow = {
  id?: string;
  connectUrl?: string;
  status?: string;
};

function toSession(row: SessionApiRow, apiKey: string): BrowserbaseSession | null {
  if (!row.id) return null;
  return {
    id: row.id,
    // Creation responses carry connectUrl; retrievals of a live session may not — the
    // documented reconnect shape is the connect endpoint keyed by session id.
    connectUrl:
      row.connectUrl ??
      `wss://connect.browserbase.com?apiKey=${encodeURIComponent(apiKey)}&sessionId=${encodeURIComponent(row.id)}`,
    status: row.status ?? "UNKNOWN",
  };
}

/**
 * Creates a keep-alive session sized to the job's wall budget. keepAlive lets the browser
 * survive between cron ticks; timeout is the Browserbase-side hard stop so an orphaned
 * session can't run up hours.
 */
export async function createBrowserbaseSession(params: {
  timeoutSeconds: number;
}): Promise<BrowserbaseResult<BrowserbaseSession>> {
  const cfg = env();
  if ("error" in cfg) return { ok: false, error: cfg.error };

  const res = await fetch(`${BROWSERBASE_API}/sessions`, {
    method: "POST",
    headers: {
      "X-BB-API-Key": cfg.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: cfg.projectId,
      keepAlive: true,
      timeout: Math.max(60, Math.min(params.timeoutSeconds, 21_600)),
      browserSettings: {
        viewport: { width: BROWSER_VIEWPORT.width, height: BROWSER_VIEWPORT.height },
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Browserbase create session ${res.status}: ${body.slice(0, 300)}` };
  }
  const row = (await res.json()) as SessionApiRow;
  const session = toSession(row, cfg.apiKey);
  if (!session) return { ok: false, error: "Browserbase create session returned no id" };
  return { ok: true, data: session };
}

export async function getBrowserbaseSession(
  sessionId: string,
): Promise<BrowserbaseResult<BrowserbaseSession>> {
  const cfg = env();
  if ("error" in cfg) return { ok: false, error: cfg.error };

  const res = await fetch(`${BROWSERBASE_API}/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { "X-BB-API-Key": cfg.apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Browserbase get session ${res.status}: ${body.slice(0, 300)}` };
  }
  const row = (await res.json()) as SessionApiRow;
  const session = toSession(row, cfg.apiKey);
  if (!session) return { ok: false, error: "Browserbase get session returned no id" };
  return { ok: true, data: session };
}

/** Asks Browserbase to release the session (terminal jobs; best-effort at call sites). */
export async function releaseBrowserbaseSession(
  sessionId: string,
): Promise<BrowserbaseResult<undefined>> {
  const cfg = env();
  if ("error" in cfg) return { ok: false, error: cfg.error };

  const res = await fetch(`${BROWSERBASE_API}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "POST",
    headers: {
      "X-BB-API-Key": cfg.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectId: cfg.projectId, status: "REQUEST_RELEASE" }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Browserbase release ${res.status}: ${body.slice(0, 300)}` };
  }
  return { ok: true, data: undefined };
}
