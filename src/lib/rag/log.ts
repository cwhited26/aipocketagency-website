// log.ts — structured logger for the RAG follow-up code (PA-RAG-8). The lane rule is "no console.log
// in production code — structured logger." This emits one JSON line per event (level + scope + message
// + fields) so Vercel's log drain captures it as structured data, without pulling in a logging
// dependency. error → stderr, info/warn → the platform's stdout/stderr capture; console.log is never
// used.

type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: Level, msg: string, fields?: Fields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "rag",
    level,
    msg,
    ...(fields ?? {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const ragLog = {
  info: (msg: string, fields?: Fields): void => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields): void => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields): void => emit("error", msg, fields),
};

/** Normalizes an unknown thrown value to a short string for logging. */
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
