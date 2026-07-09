// The captured agent idea (PA-POS-28/34 intent carry). When an anonymous visitor types a spec
// into the homepage hero or the /agents compose card, the prompt is saved here BEFORE the
// signup route — so the paywall finishes what they started instead of asking them to start
// over. /start re-saves it (covers shared /start?spec= links), /thanks reads it back after
// Stripe returns, and AgentsCompose prefills from it on the first signed-in visit, clearing
// it once the compose is actually staged. localStorage (not sessionStorage) on purpose: the
// post-payment login link may open in a new tab, and the idea has to survive that hop.

const STORAGE_KEY = "pa-agent-idea";
const MAX_LENGTH = 4_000;

export function saveAgentIdea(spec: string): void {
  const trimmed = spec.trim().slice(0, MAX_LENGTH);
  if (typeof window === "undefined" || !trimmed) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // Storage blocked (private mode / quota) — the ?spec= query param still carries the idea
    // through the same-tab flow; only the new-tab pickup is lost.
  }
}

export function readAgentIdea(): string {
  if (typeof window === "undefined") return "";
  try {
    return (window.localStorage.getItem(STORAGE_KEY) ?? "").slice(0, MAX_LENGTH);
  } catch {
    // Storage blocked — behave as if nothing was captured.
    return "";
  }
}

export function clearAgentIdea(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked — nothing was persisted, so there is nothing to clear.
  }
}
