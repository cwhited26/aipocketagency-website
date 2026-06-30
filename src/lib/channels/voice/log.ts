// lib/channels/voice/log.ts — structured logger for the Voice Call channel. One JSON line per event,
// scoped "voice", so provisioning / signature failures / cap hangups / stream errors are greppable in
// the platform logs. No console.log anywhere — every diagnostic goes through here (matches the
// channels gateway log.ts pattern; warn/error go to stderr, info to stdout).

type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: Level, msg: string, fields?: Fields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "voice",
    level,
    msg,
    ...(fields ?? {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const voiceLog = {
  info: (msg: string, fields?: Fields): void => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields): void => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields): void => emit("error", msg, fields),
};
