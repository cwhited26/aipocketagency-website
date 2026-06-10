// log.ts — structured logger for the Idea Engine (PA-IDEA-1). The lane rule is "no console.log in
// production code — structured logger." This emits one JSON line per event (level + scope + message +
// fields) so Vercel's log drain captures it as structured data, without pulling in a logging
// dependency. Mirrors lib/rag/log.ts so the two read the same.

type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: Level, msg: string, fields?: Fields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "idea-engine",
    level,
    msg,
    ...(fields ?? {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const ideaLog = {
  info: (msg: string, fields?: Fields): void => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields): void => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields): void => emit("error", msg, fields),
};

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
