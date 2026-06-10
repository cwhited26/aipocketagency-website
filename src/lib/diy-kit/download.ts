// download.ts — gate + sign the DIY Setup Kit download (PA-DIYKIT-4/5).
//
// On purchase the buyer gets a signed, time-limited download URL to the staged bundle in Supabase
// Storage. This module (1) checks the buyer holds a diy_setup_kit purchase, and (2) mints a 24-hour
// signed URL via the Storage REST API (direct REST, no SDK). The bundle object is staged in Storage by
// the build/operator step (the combined PDF/zip from buildDiyKitBundle); the path + bucket are env-driven.

const SIGN_EXPIRES_SECONDS = 24 * 60 * 60;

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

function bundleLocation(): { bucket: string; path: string } {
  return {
    bucket: process.env.DIY_KIT_BUNDLE_BUCKET ?? "downloads",
    path: process.env.DIY_KIT_BUNDLE_PATH ?? "diy-setup-kit/pocket-agent-diy-setup-kit.pdf",
  };
}

/** Does this owner hold a diy_setup_kit purchase? (Owner OR email match for not-yet-signed-up buyers.) */
export async function ownerHasDiyKitPurchase(args: {
  ownerId: string | null;
  email: string | null;
}): Promise<boolean> {
  const env = paEnv();
  if ("error" in env) return false;
  const filters: string[] = [];
  if (args.ownerId) filters.push(`user_id=eq.${encodeURIComponent(args.ownerId)}`);
  if (args.email) filters.push(`email=eq.${encodeURIComponent(args.email)}`);
  if (filters.length === 0) return false;
  // PostgREST OR across whichever identifiers we have.
  const orClause = `or=(${filters.join(",")})`;
  const res = await fetch(
    `${env.url}/rest/v1/pocket_agent_addon_purchases?kind=eq.diy_setup_kit&${orClause}&select=id&limit=1`,
    {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      cache: "no-store",
    },
  );
  if (!res.ok) return false;
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows.length > 0;
}

export type SignResult =
  | { ok: true; url: string; expiresInSeconds: number }
  | { ok: false; status: number; error: string };

/** Mint a 24-hour signed download URL for the staged DIY Kit bundle. */
export async function signDiyKitDownload(): Promise<SignResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const { bucket, path } = bundleLocation();

  const res = await fetch(`${env.url}/storage/v1/object/sign/${bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: SIGN_EXPIRES_SECONDS }),
    cache: "no-store",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text() };
  }
  const data = (await res.json()) as { signedURL?: string };
  if (!data.signedURL) {
    return { ok: false, status: 502, error: "Storage response missing signedURL" };
  }
  // signedURL is a path relative to the Storage origin; make it absolute.
  const absolute = data.signedURL.startsWith("http")
    ? data.signedURL
    : `${env.url}/storage/v1${data.signedURL.startsWith("/") ? "" : "/"}${data.signedURL}`;
  return { ok: true, url: absolute, expiresInSeconds: SIGN_EXPIRES_SECONDS };
}
