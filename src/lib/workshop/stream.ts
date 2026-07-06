// lib/workshop/stream.ts — Cloudflare Stream signed playback URLs for the workshop video +
// lobby welcome loop (PA-POS-38 §24.4: Cloudflare Stream, signed URLs, no bandwidth surprises).
//
// Local RS256 JWT signing against the Stream signing key — no API call per playback, no SDK.
// Chase provisions the key with:
//   POST /client/v4/accounts/{PA_CLOUDFLARE_STREAM_ACCOUNT_ID}/stream/keys
// which returns { id, pem } — `pem` is base64-encoded PKCS#8. Env mapping:
//   PA_CLOUDFLARE_STREAM_ACCOUNT_ID   — the Cloudflare account (kept for upload tooling)
//   PA_CLOUDFLARE_STREAM_SIGNING_KEY  — the base64 `pem` from the keys endpoint
//   PA_CLOUDFLARE_STREAM_SIGNING_KEY_ID — the `id` (JWT `kid`)
//   PA_WORKSHOP_VIDEO_UID             — the 60-minute workshop recording's Stream UID
//   PA_WORKSHOP_LOBBY_VIDEO_UID       — the 30-second lobby welcome loop's Stream UID
//
// Absence of any env is the "video not provisioned yet" state — routes surface it as a clean
// placeholder, never a crash (the same config-gate pattern as the connectors).

import { createSign } from "node:crypto";

export type StreamConfig = {
  accountId: string;
  signingKeyPem: string;
  signingKeyId: string;
  workshopVideoUid: string | null;
  lobbyVideoUid: string | null;
};

export function streamConfig(): StreamConfig | null {
  const accountId = process.env.PA_CLOUDFLARE_STREAM_ACCOUNT_ID;
  const keyB64 = process.env.PA_CLOUDFLARE_STREAM_SIGNING_KEY;
  const keyId = process.env.PA_CLOUDFLARE_STREAM_SIGNING_KEY_ID;
  if (!accountId || !keyB64 || !keyId) return null;
  let pem: string;
  try {
    pem = Buffer.from(keyB64, "base64").toString("utf8");
  } catch {
    return null;
  }
  return {
    accountId,
    signingKeyPem: pem,
    signingKeyId: keyId,
    workshopVideoUid: process.env.PA_WORKSHOP_VIDEO_UID ?? null,
    lobbyVideoUid: process.env.PA_WORKSHOP_LOBBY_VIDEO_UID ?? null,
  };
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Sign a Stream playback token for a video UID. TTL in seconds (the route uses 60 minutes). */
export function signStreamToken(
  config: Pick<StreamConfig, "signingKeyPem" | "signingKeyId">,
  videoUid: string,
  ttlSeconds: number,
  nowMs: number = Date.now(),
): string {
  const header = b64url(JSON.stringify({ alg: "RS256", kid: config.signingKeyId }));
  const payload = b64url(
    JSON.stringify({
      sub: videoUid,
      kid: config.signingKeyId,
      exp: Math.floor(nowMs / 1000) + ttlSeconds,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(config.signingKeyPem).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

/**
 * The no-controls iframe src for a signed token. controls=false strips the player UI — the
 * evergreen player can't be scrubbed or paused (§24.4); the client overlays the iframe to block
 * pointer interaction as the second layer.
 */
export function streamIframeSrc(token: string, opts: { autoplay: boolean; muted: boolean; loop: boolean }): string {
  const q = new URLSearchParams({
    autoplay: String(opts.autoplay),
    muted: String(opts.muted),
    loop: String(opts.loop),
    controls: "false",
    preload: "auto",
  });
  return `https://iframe.videodelivery.net/${token}?${q.toString()}`;
}
