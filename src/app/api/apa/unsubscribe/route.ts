import { NextResponse } from "next/server";
import {
  fetchLeadById,
  insertApaEmailEvent,
  setLeadDripSubscribed,
} from "@/lib/wc-admin-supabase";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function htmlPage(body: string, ok: boolean): string {
  const accent = ok ? "#6ee7b7" : "#fda4af";
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${ok ? "Unsubscribed" : "Unsubscribe failed"}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:64px 16px;background:#0b0b0b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;">
<div style="max-width:520px;margin:0 auto;">
<p style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:${accent};margin:0 0 16px;">AI Pocket Agency</p>
${body}
<p style="margin-top:48px;font-size:13px;color:#888;"><a href="https://aipocketagent.com" style="color:#888;text-decoration:underline;">aipocketagent.com</a></p>
</div></body></html>`;
}

function renderResult(
  status: number,
  message: string,
  ok: boolean,
): NextResponse {
  return new NextResponse(htmlPage(`<p>${message}</p>`, ok), {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const leadId = url.searchParams.get("lead") ?? "";
  const token = url.searchParams.get("token") ?? "";

  if (!UUID_RE.test(leadId) || !token) {
    return renderResult(400, "This unsubscribe link is malformed.", false);
  }
  if (!verifyUnsubscribeToken(leadId, token)) {
    return renderResult(403, "This unsubscribe link is invalid or expired.", false);
  }

  const leadResult = await fetchLeadById(leadId);
  if (!leadResult.ok) {
    console.error("[apa/unsubscribe] fetchLeadById failed", leadResult);
    return renderResult(500, "Something went wrong on our end. Try again in a moment.", false);
  }
  if (!leadResult.lead) {
    return renderResult(404, "We couldn't find that subscription.", false);
  }

  const lead = leadResult.lead;
  if (!lead.drip_subscribed) {
    return renderResult(
      200,
      "You're already unsubscribed from the Dispatch Playbook follow-up emails. No further action needed.",
      true,
    );
  }

  const updated = await setLeadDripSubscribed(leadId, false);
  if (!updated.ok) {
    console.error("[apa/unsubscribe] setLeadDripSubscribed failed", updated);
    return renderResult(500, "Something went wrong on our end. Try again in a moment.", false);
  }

  const ev = await insertApaEmailEvent({
    leadId,
    emailId: "drip",
    event: "unsubscribed",
  });
  if (!ev.ok) {
    console.error("[apa/unsubscribe] event insert failed", ev);
  }

  return renderResult(
    200,
    "You're unsubscribed from the Dispatch Playbook follow-up emails. You'll still get receipts and delivery emails for anything you actively purchase.",
    true,
  );
}
