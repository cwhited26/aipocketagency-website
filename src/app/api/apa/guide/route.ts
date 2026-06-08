import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { insertApaLead } from "@/lib/wc-admin-supabase";
import { sendEmail } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FROM = "Chase Whited <chase@aipocketagency.com>";
const GUIDE_URL =
  "https://aipocketagent.com/guide/how-i-run-4-businesses-from-my-phone.pdf";
const START_URL = "https://aipocketagent.com/start";

type GuideBody = { email?: unknown; name?: unknown };

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: GuideBody;
  try {
    body = (await req.json()) as GuideBody;
  } catch {
    return badRequest("Invalid JSON");
  }

  const email =
    typeof body.email === "string" ? body.email.trim() : "";
  const name =
    typeof body.name === "string" ? body.name.trim() : "";

  if (!EMAIL_RE.test(email)) return badRequest("Invalid email");

  const leadId = randomUUID();
  const greeting = name ? `Hey ${name}` : "Hey there";

  const htmlBody = `<p>${greeting},</p>
<p>Here's the guide: <a href="${GUIDE_URL}"><strong>How I Run 4 Businesses From My Phone Using an AI Brain</strong></a></p>
<p>Direct link if the above doesn't open: ${GUIDE_URL}</p>
<p>The guide walks through the brain pattern — what it is, how I run TVE, AthleteOS, Buildout Studios, and APA out of it, and where Pocket Agent fits for operators who don't want to configure it themselves.</p>
<p>If you want to skip ahead to the software: <a href="${START_URL}">${START_URL}</a> — 14-day free trial, no credit card.</p>
<p>— Chase</p>`;

  const textBody = `${greeting},

Here's the guide: ${GUIDE_URL}

The guide walks through the brain pattern — what it is, how I run TVE, AthleteOS, Buildout Studios, and APA out of it, and where Pocket Agent fits for operators who don't want to configure it themselves.

If you want to skip ahead to the software: ${START_URL} — 14-day free trial, no credit card.

— Chase`;

  const [leadResult, emailResult] = await Promise.all([
    insertApaLead({
      id: leadId,
      name: name || email,
      email,
      phone: null,
      source: "lead_magnet",
      status: "new",
    }),
    sendEmail({
      from: FROM,
      to: email,
      subject: "Your guide is here",
      html: htmlBody,
      text: textBody,
    }),
  ]);

  if (!leadResult.ok) {
    return NextResponse.json(
      { error: "Failed to save your info. Please try again." },
      { status: 500 },
    );
  }

  if (!emailResult.ok) {
    return NextResponse.json(
      { error: "Failed to send confirmation email. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, lead_id: leadId, guide_url: GUIDE_URL });
}
