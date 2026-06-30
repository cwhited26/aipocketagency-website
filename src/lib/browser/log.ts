// log.ts — the structured logger for Browser Automation. One JSON line per event, scoped
// "browser", so refuse-list hits / tier blocks / pool launches / tool failures are greppable in the
// platform logs. No console.log anywhere in the lane — every diagnostic goes through here (the repo
// has no pino dependency; this mirrors the per-module JSON emitter every other lane uses).

type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: Level, msg: string, fields?: Fields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "browser",
    level,
    msg,
    ...(fields ?? {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const browserLog = {
  info: (msg: string, fields?: Fields): void => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields): void => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields): void => emit("error", msg, fields),
};
