// links.ts — builds the public team-member chat + accept URLs. These surfaces live at
// the site root (/persona/<token>, /personas/accept/<token>), NOT under /app, so they
// must use the apex site origin — the app subdomain rewrites /* to /app/* (vercel.json)
// and would break a root route. Configure PA_PERSONAS_PUBLIC_BASE_URL when the apex
// differs from NEXT_PUBLIC_SITE_URL.

function baseUrl(): string {
  const raw =
    process.env.PA_PERSONAS_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://aipocketagency.com";
  return raw.replace(/\/$/, "");
}

/** The apex origin persona public surfaces are served from. */
export function personasBaseUrl(): string {
  return baseUrl();
}

export function chatUrlForToken(token: string): string {
  return `${baseUrl()}/persona/${encodeURIComponent(token)}`;
}

export function acceptUrlForToken(token: string): string {
  return `${baseUrl()}/personas/accept/${encodeURIComponent(token)}`;
}

// ── Wave 2 (public link + widget) ─────────────────────────────────────────────────────

/** The anonymous public-chat surface for a Mode B / Mode C token. */
export function publicChatUrlForToken(token: string): string {
  return `${baseUrl()}/public-persona/${encodeURIComponent(token)}`;
}

/** The widget loader script URL (served at /widget/<token>.js). */
export function widgetScriptUrlForToken(token: string): string {
  return `${baseUrl()}/widget/${encodeURIComponent(token)}.js`;
}

/** The 1-line embed snippet an owner pastes onto their site (SPEC v3 §9 Mode C). */
export function widgetSnippetForToken(token: string): string {
  return `<script src="${widgetScriptUrlForToken(token)}" async></script>`;
}
