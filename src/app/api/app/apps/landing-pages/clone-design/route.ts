// POST /api/app/apps/landing-pages/clone-design  { url, pageId? }
// Path B of the PA-LPB-13 wizard. Runs a Playwright extraction pass on the target URL (30s hard
// ceiling), converts the DesignDna result to a DesignSystemSnapshot (style tokens only — no copy,
// no assets), and returns the snapshot for the wizard preview. When pageId is provided the snapshot
// is also persisted on the page row. (PA-LPB-13)
//
// URL sanitization: blocks localhost, private IP ranges, loopback, and non-http(s) protocols before
// the browser ever opens. Style only — DesignDna physically cannot carry copy or asset files.

import { createClient } from "@/lib/supabase/server";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { hasAppEntitlement } from "@/lib/metering/entitlement";
import { withPage } from "@/lib/url-extraction/browser";
import { extractFromPage } from "@/lib/url-extraction/extract";
import { dnaToSnapshot } from "@/lib/landing-pages/design-snapshot";
import { getPage, updatePage } from "@/lib/landing-pages/pages";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLONE_DEADLINE_MS = 30_000;

const bodySchema = z.object({
  url: z.string().min(1).max(2048),
  pageId: z.string().uuid().optional(),
});

// Private/loopback CIDR ranges that must never be fetched.
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^0\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^::1$/,
  /^fd[0-9a-f]{2}:/i,
  /^169\.254\.\d+\.\d+$/,
  /\.local$/i,
  /\.internal$/i,
];

type SanitizeResult = { ok: true; url: string } | { ok: false; reason: string };

function sanitizeUrl(raw: string): SanitizeResult {
  let parsed: URL;
  try {
    // Prepend https:// if no protocol given.
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: "That doesn't look like a web address." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "Only http and https addresses are supported." };
  }

  const host = parsed.hostname.toLowerCase();
  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(host)) {
      return { ok: false, reason: "That address isn't reachable from here." };
    }
  }

  if (!host.includes(".")) {
    return { ok: false, reason: "That doesn't look like a full web address." };
  }

  return { ok: true, url: parsed.toString() };
}

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Tier OR active Project Pass (PA-POS-31) — the widened gate.
  const tier = await getCurrentTier(user.id);
  const lpbAccess = await hasAppEntitlement(user.id, "landing_page_builder", { tier });
  if (!lpbAccess.allowed) {
    return NextResponse.json(
      { error: "upgrade_required", message: "The Landing Page Builder is a Studio feature." },
      { status: 403 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const sanitized = sanitizeUrl(parsed.data.url);
  if (!sanitized.ok) {
    return NextResponse.json({ error: sanitized.reason }, { status: 400 });
  }
  const url = sanitized.url;

  const run = await withPage({ deadlineMs: CLONE_DEADLINE_MS }, (page) =>
    extractFromPage(page, url),
  );
  if (!run.ok) {
    return NextResponse.json(
      { error: run.error ?? "Couldn't read the design from that site. Try a different URL." },
      { status: 502 },
    );
  }

  const snapshot = dnaToSnapshot(run.value.dna, url);

  if (parsed.data.pageId) {
    const found = await getPage(parsed.data.pageId, user.id);
    if (found.ok && found.data) {
      await updatePage(parsed.data.pageId, user.id, {
        designSystemId: `clone:${Date.now()}`,
        designSystemImportedFrom: `clone:${url}`,
        designSystemSnapshot: snapshot,
      });
    }
  }

  return NextResponse.json({ snapshot, importedFrom: `clone:${url}` });
}
