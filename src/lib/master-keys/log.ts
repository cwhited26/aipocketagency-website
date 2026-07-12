// log.ts — structured logger for the master-key workspace-issuance lane. One JSON line per
// event, scoped "master-keys", so auth failures / issuance / rotation are greppable in the
// platform logs. Never log plaintext keys — only hashes, ids, and slugs. Mirrors the per-module
// JSON emitter every other lane uses (the repo has no pino dependency).

type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: Level, msg: string, fields?: Fields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "master-keys",
    level,
    msg,
    ...(fields ?? {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const masterKeyLog = {
  info: (msg: string, fields?: Fields): void => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields): void => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields): void => emit("error", msg, fields),
};
