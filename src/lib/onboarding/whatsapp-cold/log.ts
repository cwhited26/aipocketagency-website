// log.ts — structured logger for the WhatsApp cold-onboarding funnel (PA-POS-32). Same
// JSON-lines shape as channelLog / agentBuilderLog. No raw phone numbers ever ride a log
// line — callers pass hashPhoneForLog(sender) instead (repo PII rule).

type Fields = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", msg: string, fields?: Fields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "whatsapp-cold",
    level,
    msg,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const coldLog = {
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
};
