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

export function chatUrlForToken(token: string): string {
  return `${baseUrl()}/persona/${encodeURIComponent(token)}`;
}

export function acceptUrlForToken(token: string): string {
  return `${baseUrl()}/personas/accept/${encodeURIComponent(token)}`;
}
