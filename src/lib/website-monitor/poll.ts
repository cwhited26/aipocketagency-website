// poll.ts — the network side of a check tick (impure: fetch + TLS socket).
//
// One poll = a HEAD liveness probe, a GET for the authoritative status + body (hashed for content-drift
// detection), the combined round-trip time, and — for https URLs — the TLS certificate's notAfter read
// off a raw socket. Never throws: a transport failure comes back as { ok:false, status:null, error }.

import { createHash } from "crypto"
import { connect as tlsConnect, type PeerCertificate } from "tls"
import type { CheckResult } from "./types"

const FETCH_TIMEOUT_MS = 15_000
const TLS_TIMEOUT_MS = 10_000
const USER_AGENT = "PocketAgent-WebsiteMonitor/1.0 (+https://aipocketagent.com)"

/** Poll one URL. Pure-ish: the only inputs are the URL + the clock; the only outputs are the result. */
export async function pollUrl(url: string): Promise<CheckResult> {
  const start = Date.now()
  let status: number | null = null
  let contentHash: string | null = null
  let error: string | null = null

  // HEAD first — a cheap liveness probe. A 405 (HEAD not allowed) is not a failure; the GET is
  // authoritative, so we only keep the HEAD status as a fallback when the GET itself errors.
  let headStatus: number | null = null
  try {
    const headRes = await fetchWithTimeout(url, "HEAD")
    headStatus = headRes.status
  } catch {
    // ignored — many servers reject HEAD; the GET below decides up/down.
  }

  try {
    const getRes = await fetchWithTimeout(url, "GET")
    status = getRes.status
    const body = await getRes.text()
    contentHash = createHash("sha256").update(body).digest("hex")
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
    status = headStatus // fall back to the HEAD status if we got one before the GET failed
  }

  const responseMs = Date.now() - start
  const ok = status !== null && status >= 200 && status < 400 && error === null

  const sslExpiresAt = await readSslExpiry(url)

  return { ok, status, responseMs, contentHash, sslExpiresAt, error }
}

async function fetchWithTimeout(url: string, method: "HEAD" | "GET"): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT },
      cache: "no-store",
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Read the TLS certificate notAfter for an https URL, as an ISO string. Returns null for http URLs,
 * unparseable URLs, or any socket error — the SSL alert only fires on a cert we actually read.
 */
async function readSslExpiry(url: string): Promise<string | null> {
  let host: string
  let port: number
  try {
    const u = new URL(url)
    if (u.protocol !== "https:") return null
    host = u.hostname
    port = u.port ? Number(u.port) : 443
  } catch {
    return null
  }

  return new Promise<string | null>((resolve) => {
    let settled = false
    const finish = (value: string | null): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(value)
    }

    const socket = tlsConnect(
      { host, port, servername: host, timeout: TLS_TIMEOUT_MS, rejectUnauthorized: false },
      () => {
        const cert: PeerCertificate = socket.getPeerCertificate()
        if (!cert || !cert.valid_to) return finish(null)
        const parsed = new Date(cert.valid_to)
        finish(Number.isNaN(parsed.getTime()) ? null : parsed.toISOString())
      },
    )
    socket.on("timeout", () => finish(null))
    socket.on("error", () => finish(null))
  })
}
