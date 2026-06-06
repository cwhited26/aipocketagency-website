// widget.ts — Mode C (website widget) server-side helpers (SPEC v3 §9 Mode C;
// Adversarial Brief §3(h) domain-allowlist bypass). Three concerns:
//   1. Origin allowlist matching — EXACT scheme://host[:port], no subdomain/look-alike
//      wildcarding, null origins rejected. Used by the widget loader and the chat API.
//   2. frame-ancestors CSP — the browser-enforced gate on WHERE the embed iframe may be
//      framed. This is the real "can't embed on an unlisted domain" enforcement, since
//      our share tokens are opaque (no signed domain claim) and the chat fetch from the
//      iframe is same-origin to our app.
//   3. The bubble loader JS — the dependency-free snippet served at /widget/<token>.js.
//
// Matching is pure + unit-tested (__tests__/widget.test.ts) including the rejection
// cases the brief enumerates: null origin, look-alike domain, unlisted subdomain, scheme
// mismatch, and direct API call from an unlisted origin.

/**
 * Normalizes an Origin/Referer header value to `scheme://host[:port]`, lowercased, no
 * trailing slash. Returns null for anything unusable: the literal "null" origin (sandboxed
 * iframe / file://), a malformed value, or a non-http(s) scheme.
 */
export function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value || value === "null") return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const port = url.port ? `:${url.port}` : "";
  return `${url.protocol}//${url.hostname}${port}`.toLowerCase();
}

/**
 * EXACT allowlist membership. No wildcards, no subdomain promotion, no homograph
 * tolerance — `https://evil-example.com` and `https://app.example.com` do NOT match
 * `https://example.com`. A null/unparseable origin is always rejected.
 */
export function isOriginAllowed(origin: string | null, allowlist: string[]): boolean {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return allowlist.some((a) => normalizeOrigin(a) === normalized);
}

/**
 * Builds the `Content-Security-Policy: frame-ancestors …` value for the embed page. When
 * the allowlist is empty the widget effectively can't be framed anywhere (only 'self'),
 * which is the safe default before an owner configures origins.
 */
export function buildFrameAncestors(allowlist: string[]): string {
  const origins = allowlist
    .map((a) => normalizeOrigin(a))
    .filter((o): o is string => o !== null);
  return ["'self'", ...origins].join(" ");
}

// ── Bubble loader JS ────────────────────────────────────────────────────────────────

export type WidgetLoaderParams = {
  token: string;
  baseUrl: string;
  personaName: string;
  greeting: string;
  bubbleColor: string;
  position: "bottom-right" | "bottom-left";
};

/**
 * Generates the dependency-free IIFE served at /widget/<token>.js. Injects a floating
 * bubble; clicking it opens an iframe to the public chat surface in embed mode (which
 * reuses all the public-link plumbing + rate limits + abuse defense). All interpolated
 * values are JSON-encoded so a config value can never break out of the JS string context.
 */
export function buildWidgetLoaderJs(p: WidgetLoaderParams): string {
  // Escape `<` (and U+2028/U+2029) so a config value can never break out of a <script>
  // context or terminate the string — standard safe-JSON-in-script hardening.
  const cfg = JSON.stringify({
    token: p.token,
    src: `${p.baseUrl}/public-persona/${encodeURIComponent(p.token)}?embed=1`,
    name: p.personaName,
    greeting: p.greeting,
    color: p.bubbleColor,
    position: p.position,
  })
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `(function(){
  if (window.__paPersonaWidgetLoaded) return;
  window.__paPersonaWidgetLoaded = true;
  var cfg = ${cfg};
  var side = cfg.position === 'bottom-left' ? 'left' : 'right';
  var open = false;

  var bubble = document.createElement('button');
  bubble.setAttribute('aria-label', 'Open chat with ' + cfg.name);
  bubble.style.cssText = 'position:fixed;bottom:20px;'+side+':20px;width:56px;height:56px;border:none;border-radius:50%;cursor:pointer;z-index:2147483646;box-shadow:0 4px 14px rgba(0,0,0,0.25);background:'+cfg.color+';color:#06222a;font-size:24px;display:flex;align-items:center;justify-content:center;';
  bubble.textContent = '💬';

  var frame = document.createElement('iframe');
  frame.title = cfg.name;
  frame.style.cssText = 'position:fixed;bottom:88px;'+side+':20px;width:380px;max-width:calc(100vw - 40px);height:560px;max-height:calc(100vh - 120px);border:none;border-radius:16px;z-index:2147483647;box-shadow:0 8px 30px rgba(0,0,0,0.35);display:none;background:#05070a;';

  bubble.addEventListener('click', function(){
    open = !open;
    if (open && !frame.src) frame.src = cfg.src;
    frame.style.display = open ? 'block' : 'none';
    bubble.textContent = open ? '✕' : '💬';
  });

  function mount(){
    document.body.appendChild(frame);
    document.body.appendChild(bubble);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();`;
}

/** Returned when the widget loader is requested from a non-allowlisted origin. */
export function buildBlockedLoaderJs(): string {
  return `console.error("[Pocket Agent] This widget is not authorized for this domain. Add it to the allowed origins in your Pocket Agent persona settings.");`;
}

/** The default greeting open prompt for a persona (SPEC v3 §9 Mode C "Open prompt"). */
export function defaultOpenPrompt(personaName: string): string {
  return `Hi, I'm ${personaName}. What can I help you with?`;
}
