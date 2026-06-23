// meeting-persona/log.ts — scoped structured logger for the Meeting Persona orchestration layer
// (MP-CORE-2+). Per-module JSON emitter (the repo has no central logger). Never console.log.

type LogFields = Record<string, unknown>;
type Level = "info" | "warn" | "error";

function emit(level: Level, msg: string, fields?: LogFields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "meeting-persona",
    level,
    msg,
    ...(fields ?? {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (msg: string, f?: LogFields) => emit("info", msg, f),
  warn: (msg: string, f?: LogFields) => emit("warn", msg, f),
  error: (msg: string, f?: LogFields) => emit("error", msg, f),
};
