// connectors/recall-ai/log.ts — scoped structured logger for the Recall.ai connector (Meeting
// Persona, MP-CORE-1). The repo has no central logger module; each surface defines its own scoped
// JSON emitter (the moonchild/channels pattern). Never console.log — always a structured line so
// the connector's lifecycle is greppable by `scope` in production logs.

type LogFields = Record<string, unknown>;
type Level = "info" | "warn" | "error";

function emit(level: Level, msg: string, fields?: LogFields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "connectors.recall-ai",
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
