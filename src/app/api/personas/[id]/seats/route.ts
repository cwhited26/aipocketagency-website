import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnedPersona, resolveOwner } from "@/lib/personas/owner";
import {
  insertShareToken,
  listSeatTokens,
  listSeats,
  PersonaDbError,
  upsertSeat,
} from "@/lib/personas/db";
import { canInviteSeat } from "@/lib/personas/tier-caps";
import { generateShareToken, isTokenLive } from "@/lib/personas/tokens";
import { acceptUrlForToken } from "@/lib/personas/links";
import { sendEmail } from "@/lib/resend";
import { SEAT_ROLES, type PersonaShareTokenRow } from "@/lib/personas/types";
import { markOnboardingStepComplete } from "@/lib/onboarding/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FROM = "Chase Whited <chase@aipocketagent.com>";
const REPLY_TO = "chase@aipocketagent.com";

type Params = { params: { id: string } };

// GET — list seats with their live invite/chat link (for the Team tab).
export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const seats = await listSeats(params.id);
    const withTokens = await Promise.all(
      seats.map(async (seat) => {
        const tokens = await listSeatTokens(seat.id);
        const live = tokens.find((t) => isTokenLive(t));
        return {
          ...seat,
          inviteUrl: live ? acceptUrlForToken(live.token) : null,
        };
      }),
    );
    return NextResponse.json({ seats: withTokens });
  } catch (e) {
    return fail(e);
  }
}

const inviteSchema = z.object({
  email: z.string().email().max(200),
  role: z.enum(SEAT_ROLES).default("member"),
});

// POST — invite a team member: create/refresh the seat, mint a personal token, email it.
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });
    const { persona } = owned;

    const cap = await canInviteSeat(persona.id);
    if (!cap.ok) return NextResponse.json({ error: cap.reason, capped: true }, { status: 403 });

    const seat = await upsertSeat({
      persona_id: persona.id,
      invited_email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
    });

    const token = generateShareToken();
    const tokenRow: PersonaShareTokenRow = await insertShareToken({
      token,
      persona_id: persona.id,
      seat_id: seat.id,
      expires_at: null,
    });
    const acceptUrl = acceptUrlForToken(tokenRow.token);

    const send = await sendEmail({
      from: FROM,
      to: seat.invited_email,
      replyTo: REPLY_TO,
      subject: `You've been given access to ${persona.name}`,
      html: inviteHtml(persona.name, acceptUrl),
      text: inviteText(persona.name, acceptUrl),
    });
    // PA-POS-36: the first seat invite completes "Invite a teammate" — the seat + link exist
    // even when the email failed, so the invite counts either way. Never throws.
    await markOnboardingStepComplete(owner.ctx.userId, "invite_teammate");

    // The seat + token exist regardless; if the email fails the owner can copy the
    // link from the Team tab. Surface the email failure rather than swallow it.
    return NextResponse.json(
      {
        seat,
        inviteUrl: acceptUrl,
        emailSent: send.ok,
        emailError: send.ok ? null : send.error,
      },
      { status: 201 },
    );
  } catch (e) {
    return fail(e);
  }
}

function inviteHtml(personaName: string, url: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
  <p>You've been given access to <strong>${escapeHtml(personaName)}</strong> — an AI assistant your team can chat with.</p>
  <p><a href="${url}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open ${escapeHtml(personaName)}</a></p>
  <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br>${url}</p>
  <p style="color:#94a3b8;font-size:12px">Built with Pocket Agent.</p>
</div>`;
}

function inviteText(personaName: string, url: string): string {
  return `You've been given access to ${personaName}, an AI assistant your team can chat with.\n\nOpen it here: ${url}\n\nBuilt with Pocket Agent.`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

function fail(e: unknown): NextResponse {
  const status = e instanceof PersonaDbError ? e.status : 500;
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Unexpected error" },
    { status },
  );
}
