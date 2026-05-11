type Attachment = {
  filename: string;
  path: string;
};

type SendEmailArgs = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[];
  replyTo?: string;
};

type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string };

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { ok: false, status: 500, error: "RESEND_API_KEY not set" };
  }

  type Body = {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
    attachments?: Attachment[];
    reply_to?: string;
  };

  const body: Body = {
    from: args.from,
    to: [args.to],
    subject: args.subject,
    html: args.html,
    text: args.text,
  };
  if (args.attachments && args.attachments.length > 0) {
    body.attachments = args.attachments;
  }
  if (args.replyTo) {
    body.reply_to = args.replyTo;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: text };
  }

  let parsed: { id?: string };
  try {
    parsed = JSON.parse(text) as { id?: string };
  } catch {
    return { ok: false, status: 500, error: `Resend returned non-JSON: ${text}` };
  }
  if (!parsed.id) {
    return { ok: false, status: 500, error: `Resend response missing id: ${text}` };
  }
  return { ok: true, id: parsed.id };
}
