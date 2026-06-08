// denylist.ts — source-config URL screening (PA-LS-5 + the adversarial review note).
//
// A Lead Source's URL list is owner-supplied, so it can include URLs that point at private surfaces
// (admin panels, login pages, internal dashboards) — scraping those is wasteful at best and a
// trust/abuse problem at worst. We screen every URL at create time AND on every run: a URL that was
// fine when the source was created can later trip the denylist (a path changes), so the run logs the
// trip to pa_lead_scout_runs.config_warnings instead of silently scraping or silently skipping.

// Path fragments that mark a non-public / sensitive surface. Matched case-insensitively against the
// pathname so "/Admin" and "/admin/users" both trip.
const DENY_PATTERNS = [/\/admin/i, /\/login/i, /\/internal/i, /\/account/i, /\/dashboard/i];

export type UrlScreen =
  | { ok: true; url: string; domain: string }
  | { ok: false; url: string; reason: string };

/** Lowercased registrable host of a URL, for the brain path + display. "" if unparseable. */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Screen a single URL. Rejects anything that isn't a well-formed http(s) URL or whose path matches a
 * denylist pattern, with a clear human reason the route/run surfaces verbatim.
 */
export function screenUrl(raw: string): UrlScreen {
  const url = raw.trim();
  if (!url) return { ok: false, url: raw, reason: "Empty URL." };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, url, reason: "Not a valid URL — include the full https:// address." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, url, reason: "Only http and https URLs are supported." };
  }

  const matched = DENY_PATTERNS.find((p) => p.test(parsed.pathname));
  if (matched) {
    return {
      ok: false,
      url,
      reason: `Looks like a private page (matched ${matched.source}). Lead Scout only visits public pages.`,
    };
  }

  return { ok: true, url, domain: domainOf(url) };
}

/** Split + screen a whole list. Returns the clean URLs and the rejected ones with reasons. */
export function screenUrlList(urls: string[]): {
  ok: { url: string; domain: string }[];
  rejected: { url: string; reason: string }[];
} {
  const ok: { url: string; domain: string }[] = [];
  const rejected: { url: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const screen = screenUrl(raw);
    if (!screen.ok) {
      rejected.push({ url: screen.url, reason: screen.reason });
      continue;
    }
    if (seen.has(screen.url)) continue; // de-dup exact repeats
    seen.add(screen.url);
    ok.push({ url: screen.url, domain: screen.domain });
  }
  return { ok, rejected };
}
