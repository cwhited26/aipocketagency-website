import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertRegistration } from "@/lib/webinar/registrations";
import { resolveWebinarAtMs } from "@/lib/webinar/config";
import { enqueueWebinar } from "@/lib/emails/enqueue";
import { cancelPendingForEmailSequence } from "@/lib/emails/queue";
import { SEQUENCE } from "@/lib/emails/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Boundary validation for the public webinar registration (Part 3A "Save My Seat"). Email is required;
// name + phone are optional. The session id is reserved for future multi-session scheduling.
const BodySchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.string().email(),
  ),
  firstName: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().max(120).optional().default(""),
  ),
  phone: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().max(40).optional().default(""),
  ),
  webinarSessionId: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().max(120).optional().default(""),
  ),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email to save your seat." },
      { status: 400 },
    );
  }

  const { email, firstName, phone, webinarSessionId } = parsed.data;

  // Persist the registration (idempotent upsert on email).
  const reg = await upsertRegistration({
    email,
    firstName: firstName || null,
    phone: phone || null,
    webinarSessionId: webinarSessionId || null,
  });
  if (!reg.ok) {
    console.error("[webinar/register] failed to persist registration", {
      status: reg.status,
      error: reg.error,
    });
    return NextResponse.json(
      { error: "We couldn't save your seat. Try again in a minute." },
      { status: 503 },
    );
  }

  // Re-registration: clear the prior pending webinar schedule so we don't double-send, then enqueue a
  // fresh sequence anchored to the next session. The registration row is the binding either way.
  const cleared = await cancelPendingForEmailSequence(email, SEQUENCE.webinar, "re_registered");
  if (!cleared.ok) {
    console.error("[webinar/register] failed to clear prior schedule", {
      status: cleared.status,
      error: cleared.error,
    });
    // Non-fatal: the registration is saved. Fall through and still try to enqueue.
  }

  const now = Date.now();
  const enq = await enqueueWebinar(
    { ownerId: null, email, firstName: firstName || null },
    resolveWebinarAtMs(now),
    now,
  );
  if (!enq.ok) {
    console.error("[webinar/register] failed to enqueue sequence", { error: enq.error });
    // The seat is saved even if the email enqueue failed; don't fail the user-facing flow.
    return NextResponse.json({ ok: true, scheduled: 0, redirect: "/training-confirmed" });
  }

  return NextResponse.json({ ok: true, scheduled: enq.count, redirect: "/training-confirmed" });
}
