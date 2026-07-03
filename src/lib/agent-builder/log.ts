// log.ts — structured logger for the Custom Agent Builder (PA-POS-27). Same JSON-line shape as
// lib/channels/voice/log.ts so every scope greps the same way. No console.log — repo rule.

type Level = "info" | "warn" | "error";
type Fields = Record<string, string | number | boolean | null | undefined>;

function emit(level: Level, msg: string, fields?: Fields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "agent-builder",
    level,
    msg,
    ...(fields ?? {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const agentBuilderLog = {
  info: (msg: string, fields?: Fields): void => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields): void => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields): void => emit("error", msg, fields),
};
