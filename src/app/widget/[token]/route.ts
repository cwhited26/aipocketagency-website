// /widget/<token>.js — the Mode C widget loader. Returns the dependency-free JS that
// injects a chat bubble into the host page; clicking it opens an iframe at
// /public-persona/<token>?embed=1 (sharing all the public-link plumbing). Behind the
// PA_PERSONAS_PUBLIC_MODES_ENABLED flag.
//
// The dynamic segment captures the trailing `.js` (e.g. "abc123.js"); we strip it to
// recover the token. Domain-allowlist enforcement here is the first gate (the host
// page's Referer must be allowlisted); the embed page's frame-ancestors CSP and the
// chat API's Origin check are the deeper gates (Adversarial Brief §3(h)).

import { fetchPersona, fetchShareToken, fetchWidgetConfig } from "@/lib/personas/db";
import { isTokenLive } from "@/lib/personas/tokens";
import { publicModesEnabled } from "@/lib/personas/feature-flags";
import { personasBaseUrl } from "@/lib/personas/links";
import { buildBlockedLoaderJs, buildWidgetLoaderJs, isOriginAllowed, normalizeOrigin } from "@/lib/personas/widget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { token: string } };

function js(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(req: Request, { params }: Params): Promise<Response> {
  const token = params.token.replace(/\.js$/i, "");

  if (!publicModesEnabled()) {
    return js(
      `console.warn("[Pocket Agent] This widget is launching soon.");`,
      503,
    );
  }

  const tokenRow = await fetchShareToken(token);
  if (!tokenRow || !isTokenLive(tokenRow) || tokenRow.mode !== "widget") {
    return js(buildBlockedLoaderJs(), 404);
  }

  const [persona, config] = await Promise.all([
    fetchPersona(tokenRow.persona_id),
    fetchWidgetConfig(tokenRow.persona_id),
  ]);
  if (!persona || persona.status === "archived") {
    return js(buildBlockedLoaderJs(), 404);
  }

  // Domain allowlist: the host page that loaded this <script> is identified by Referer.
  // An empty allowlist means the owner hasn't authorized any domain yet → refuse.
  const referer = req.headers.get("referer");
  const origin = referer ? normalizeOrigin(referer) : req.headers.get("origin");
  if (!isOriginAllowed(origin, config?.allowed_origins ?? [])) {
    return js(buildBlockedLoaderJs(), 200);
  }

  return js(
    buildWidgetLoaderJs({
      token,
      baseUrl: personasBaseUrl(),
      personaName: persona.name,
      greeting: config?.greeting_text ?? "Hi! How can I help you today?",
      bubbleColor: config?.bubble_color ?? "#22d3ee",
      position: config?.bubble_position ?? "bottom-right",
    }),
  );
}
