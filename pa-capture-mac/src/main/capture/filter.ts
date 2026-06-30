// Pure source-app allow/deny matching. A capture is gated by the app it came from (the active-win
// owner name) before it ever enters the queue. Deny always wins; an allow list, when non-empty,
// restricts capture to only the named apps. No Electron imports → directly unit-tested.

export interface AppFilter {
  /** When non-empty, capture ONLY from these apps (everything else is excluded). */
  allowlist: string[];
  /** Never capture from these apps (1Password, banking, etc.). Takes precedence over the allowlist. */
  denylist: string[];
}

/** Normalize an app name for comparison: trimmed + lowercased. */
export function normalizeAppName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

/**
 * Decide whether a capture from `sourceApp` is allowed under the filter.
 *   • On the deny list → never (deny wins, even if also on the allow list).
 *   • Allow list non-empty → only apps on it; an unknown source app (null) is excluded.
 *   • Allow list empty → everything not denied is allowed.
 */
export function shouldCaptureFromApp(
  sourceApp: string | null | undefined,
  filter: AppFilter,
): boolean {
  const app = normalizeAppName(sourceApp);
  const deny = filter.denylist.map(normalizeAppName).filter(Boolean);
  if (app && deny.includes(app)) return false;

  const allow = filter.allowlist.map(normalizeAppName).filter(Boolean);
  if (allow.length > 0) {
    if (!app) return false; // unknown source app is excluded while an allow list is active
    return allow.includes(app);
  }
  return true;
}
