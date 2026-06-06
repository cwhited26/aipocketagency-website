// feature-flag.ts — the single gate for the chat-as-surface home (PA v5 Wave A).
//
// The new /app/home surface and the gated dashboard redirects all read this flag at request
// time. Default (unset) = OFF → /app/home redirects back to the existing tabbed UI and the
// old routes work unchanged. Chase flips PA_CHAT_AS_HOME=true on Vercel after testing, which
// makes chat the canonical home. Decision PA-ORCH-12: don't burn the bridge before the boat
// is built.

/** True only when the operator has explicitly enabled the chat-as-surface home. */
export function chatAsHomeEnabled(): boolean {
  return process.env.PA_CHAT_AS_HOME === "true";
}

/** Where /app lands the owner: the chat home when enabled, else the existing brain home. */
export const TABBED_HOME_PATH = "/app/brain";
export const CHAT_HOME_PATH = "/app/home";
