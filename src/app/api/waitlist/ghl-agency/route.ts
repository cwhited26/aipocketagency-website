// POST /api/waitlist/ghl-agency — the design-partner waitlist behind /for/ghl-agency
// (Pocket Agent for GHL Agencies SPEC v1 §9). Rate-limit by IP → Zod-validate → upsert the row
// (migration 109) → email Chase the submission so he can reach out personally. The email is
// best-effort: the row is the record; a Resend failure logs and the visitor still gets a yes.

import { NextResponse } from "next/server";
import { GhlWaitlistSchema } from "@/lib/ghl-waitlist/schema";
import { upsertWaitlistEntry } from "@/lib/ghl-waitlist/store";
import { hitRateLimit, pruneExpired, type RateWindow } from "@/lib/ghl-waitlist/rate-limit";
import { sendEmail } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WAITLIST_EMAIL = "chase@aipocketagent.com";

// Per-instance window store (see lib/ghl-waitlist/rate-limit.ts for why in-process is enough).
const rateStore = new Map<string, RateWindow>();

function clientIp(req: Request): string {
  // Vercel sets x-real-ip from its proxy (harder to spoof than a client-prepended
  // x-forwarded-for entry); fall back to the first forwarded hop.
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function POST(request: Request): Promise<NextResponse> {
  const now = Date.now();
  pruneExpired(rateStore, now);
  const rate = hitRateLimit(rateStore, clientIp(request), now);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many submissions from this connection. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = GhlWaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Fill in every field with a valid email to reserve your seat." },
      { status: 400 },
    );
  }
  const entry = parsed.data;

  const saved = await upsertWaitlistEntry(entry);
  if (!saved.ok) {
    console.error("[waitlist/ghl-agency] failed to persist entry", {
      status: saved.status,
      error: saved.error,
    });
    return NextResponse.json(
      { error: "We couldn't save your spot. Try again in a minute." },
      { status: 503 },
    );
  }

  const lines = [
    `Name: ${entry.name}`,
    `Email: ${entry.email}`,
    `Agency: ${entry.agencyName}`,
    `Client sub-accounts today: ${entry.clientCount}`,
    `#1 GHL frustration: ${entry.topFrustration}`,
    `Referrer: ${entry.referrer || "(none)"}`,
    `Row id: ${saved.row.id}`,
  ];
  const emailed = await sendEmail({
    from: WAITLIST_EMAIL,
    to: WAITLIST_EMAIL,
    replyTo: entry.email,
    subject: `[GHL Waitlist] ${entry.agencyName} — ${entry.clientCount} clients`,
    text: lines.join("\n"),
    html: `<p>${lines.map((l) => escapeHtml(l)).join("<br/>")}</p>`,
  });
  if (!emailed.ok) {
    // Non-fatal: the row is saved; Chase reads the table even if the notification drops.
    console.error("[waitlist/ghl-agency] failed to email notification", {
      status: emailed.status,
      error: emailed.error,
    });
  }

  return NextResponse.json({ ok: true });
}
