import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { insertApaLead } from "@/lib/wc-admin-supabase";
import { sendEmail } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FROM = "Chase Whited <chase@aipocketagency.com>";
const POCKET_AGENT_URL = "https://aipocketagency.com/pocket-agent";
const START_URL = "https://aipocketagency.com/start";

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
<p>You'll get <strong>"How I Run 4 Businesses From My Phone Using an AI Brain"</strong> in your inbox within the next few days — Chase is putting the final polish on it.</p>
<p>In the meantime, here's where to start: <a href="${POCKET_AGENT_URL}">${POCKET_AGENT_URL}</a></p>
<p>If you're impatient, kick off your free Pocket Agent trial right now: <a href="${START_URL}">${START_URL}</a></p>
<p>— Chase</p>`;

  const textBody = `${greeting},

You'll get "How I Run 4 Businesses From My Phone Using an AI Brain" in your inbox within the next few days — Chase is putting the final polish on it.

In the meantime, here's where to start: ${POCKET_AGENT_URL}

If you're impatient, kick off your free Pocket Agent trial right now: ${START_URL}

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
      subject: "Your AI Pocket Agency guide is on its way",
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

  return NextResponse.json({ ok: true, lead_id: leadId });
}
