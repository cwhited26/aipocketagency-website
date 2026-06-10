// parser.ts — the natural-language schedule parser + the cron next-run math (PA-RITUAL-3).
//
// This is the module that lets the owner type "every Monday at 8am" instead of "0 8 * * 1". No LLM
// call — cost discipline (SPEC §7): a normalize pass, then an ordered set of pattern matchers (every-N
// minutes/hours, daily, weekdays, weekends, monthly-on-a-day, every-other-DOW, a named day, and a
// day-of-week + hour-of-day fallback). When nothing is extractable the parser fails CLOSED with a
// reason the API turns into the "what time should this run?" picker — never a raw-cron prompt.
//
// The same module computes the next fire time from the stored cron (cronNextRun) and the "Next 3 runs"
// preview the create flow shows before save (nextRuns). All pure — safe to import in the client preview
// and the server sweep alike. Times are computed in UTC (the cron schedule fields are interpreted as
// UTC, matching how the vercel.json crons fire); the owner's verbatim phrase is preserved separately on
// the row so the UI shows what he typed, not the cron.

// ── Public result types ────────────────────────────────────────────────────────────

export type ParsedSchedule = {
  /** The canonical 5-field cron stored on the ritual row. */
  cron: string;
  /** "every other …" — the one non-standard case, resolved by the sweep against last_run_at (SPEC §7). */
  biWeekly: boolean;
  /** A plain-English description of the parsed schedule, for the create-flow confirmation. */
  summary: string;
};

export type ParseResult =
  | { ok: true; schedule: ParsedSchedule }
  | { ok: false; reason: string };

// ── Normalize ──────────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Time-of-day extraction ───────────────────────────────────────────────────────

type TimeOfDay = { hour: number; minute: number };

const NAMED_TIMES: Record<string, TimeOfDay> = {
  midnight: { hour: 0, minute: 0 },
  morning: { hour: 8, minute: 0 },
  noon: { hour: 12, minute: 0 },
  midday: { hour: 12, minute: 0 },
  afternoon: { hour: 14, minute: 0 },
  evening: { hour: 18, minute: 0 },
  night: { hour: 20, minute: 0 },
};

/** Pull an explicit or named time out of the phrase. "7am" / "8:30 am" / "17:00" / "5pm" / "noon" /
 *  "end of day". Returns null when no time is mentioned (the caller applies a sensible default). */
function extractTime(text: string): TimeOfDay | null {
  if (/\bend of day\b|\beod\b/.test(text)) return { hour: 17, minute: 0 };
  for (const [word, t] of Object.entries(NAMED_TIMES)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return t;
  }
  // "8:30am", "8:30 am", "8am", "8 am", "17:00", "5pm", "at 9"
  const m = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (!m) return null;
  // Guard: a bare "every 6 hours" / "every 15 minutes" number is not a time — those are matched earlier,
  // but defend anyway: if the surrounding phrase is an interval, skip.
  if (/\bevery\s+\d+\s+(hour|hours|minute|minutes|min|mins)\b/.test(text)) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const ampm = m[3];
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

// ── Day-of-week extraction ─────────────────────────────────────────────────────────

const DOW_NAMES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const DOW_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function extractDow(text: string): number | null {
  for (const [word, n] of Object.entries(DOW_NAMES)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return n;
  }
  return null;
}

// ── Day-of-month extraction ────────────────────────────────────────────────────────

const ORDINAL_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  tenth: 10,
  fifteenth: 15,
  twentieth: 20,
  last: 28, // a safe "end of month" approximation (every month has a 28th)
};

function extractDom(text: string): number | null {
  for (const [word, n] of Object.entries(ORDINAL_WORDS)) {
    if (new RegExp(`\\bthe ${word}\\b|\\bon the ${word}\\b`).test(text)) return n;
  }
  const m = text.match(/\bon the (\d{1,2})(?:st|nd|rd|th)?\b/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 31) return n;
  }
  return null;
}

// ── Formatting ─────────────────────────────────────────────────────────────────────

function formatTime(t: TimeOfDay): string {
  const ampm = t.hour < 12 ? "AM" : "PM";
  let h = t.hour % 12;
  if (h === 0) h = 12;
  const mm = String(t.minute).padStart(2, "0");
  return `${h}:${mm} ${ampm}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// ── The parser ─────────────────────────────────────────────────────────────────────

/** Parse the owner's typed schedule into a cron + a confirmation summary, or fail with a reason that
 *  drives the hour-of-day + day-of-week picker (PA-RITUAL-3). Never throws. */
export function parseSchedule(input: string): ParseResult {
  const text = normalize(input);
  if (!text) return { ok: false, reason: "Type when this should run, like \"every Monday at 8am\"." };

  // 1 · every N minutes
  const everyMin = text.match(/\bevery\s+(\d{1,3})\s*(?:minutes?|mins?)\b/);
  if (everyMin) {
    const n = Number(everyMin[1]);
    if (n >= 1 && n <= 59) {
      return ok(`*/${n} * * * *`, false, `Every ${n} minute${n === 1 ? "" : "s"}`);
    }
    if (n === 60) return ok("0 * * * *", false, "Every hour");
  }

  // 2 · every N hours / hourly
  if (/\bhourly\b/.test(text)) return ok("0 * * * *", false, "Every hour");
  const everyHour = text.match(/\bevery\s+(\d{1,2})\s*hours?\b/);
  if (everyHour) {
    const n = Number(everyHour[1]);
    if (n >= 1 && n <= 23) return ok(`0 */${n} * * *`, false, `Every ${n} hours`);
    if (n === 24) {
      const t = extractTime(text) ?? { hour: 9, minute: 0 };
      return ok(`${t.minute} ${t.hour} * * *`, false, `Every day at ${formatTime(t)}`);
    }
  }

  // 3 · monthly — "monthly on the first", "every month on the 15th", "first of the month"
  const isMonthly =
    /\bmonth(ly)?\b/.test(text) || /\bof (the|each|every) month\b/.test(text) || /\beach month\b/.test(text);
  if (isMonthly) {
    const dom = extractDom(text) ?? 1;
    const t = extractTime(text) ?? { hour: 9, minute: 0 };
    return ok(`${t.minute} ${t.hour} ${dom} * *`, false, `Monthly on the ${ordinal(dom)} at ${formatTime(t)}`);
  }

  // 4 · every other <day> — the bi-weekly case
  const biWeekly = /\bevery other\b|\bbi-?weekly\b|\bevery two weeks\b|\bevery 2 weeks\b/.test(text);
  if (biWeekly) {
    const dow = extractDow(text);
    const t = extractTime(text) ?? { hour: 8, minute: 0 };
    if (dow !== null) {
      return ok(`${t.minute} ${t.hour} * * ${dow}`, true, `Every other ${DOW_LABEL[dow]} at ${formatTime(t)}`);
    }
    // "every other week" with no day → anchor to Monday.
    return ok(`${t.minute} ${t.hour} * * 1`, true, `Every other Monday at ${formatTime(t)}`);
  }

  // 5 · weekdays / weekends
  if (/\bweekdays?\b|\bevery weekday\b/.test(text)) {
    const t = extractTime(text) ?? { hour: 9, minute: 0 };
    return ok(`${t.minute} ${t.hour} * * 1-5`, false, `Every weekday at ${formatTime(t)}`);
  }
  if (/\bweekends?\b/.test(text)) {
    const t = extractTime(text) ?? { hour: 9, minute: 0 };
    return ok(`${t.minute} ${t.hour} * * 0,6`, false, `Every weekend day at ${formatTime(t)}`);
  }

  // 6 · a named day of the week — "every Monday", "on Wednesdays", "Friday mornings"
  const dow = extractDow(text);
  if (dow !== null) {
    const t = extractTime(text) ?? { hour: 9, minute: 0 };
    return ok(`${t.minute} ${t.hour} * * ${dow}`, false, `Every ${DOW_LABEL[dow]} at ${formatTime(t)}`);
  }

  // 7 · daily — "every day", "daily", "each day", or a bare time with no day
  const isDaily = /\bevery day\b|\bdaily\b|\beach day\b|\beveryday\b/.test(text);
  const t = extractTime(text);
  if (isDaily || t) {
    const time = t ?? { hour: 9, minute: 0 };
    return ok(`${time.minute} ${time.hour} * * *`, false, `Every day at ${formatTime(time)}`);
  }

  // Fallback: nothing extractable → the picker (PA-RITUAL-3 — never a raw-cron prompt).
  return {
    ok: false,
    reason:
      "I couldn't read a schedule from that. Pick a day and a time — like \"every Monday at 8am\" or \"weekdays at 9\".",
  };
}

function ok(cron: string, biWeekly: boolean, summary: string): ParseResult {
  return { ok: true, schedule: { cron, biWeekly, summary } };
}

// ── Cron evaluation ──────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

// Expand one cron field (`*`, a step like `*` slash n, `a-b`, `a-b` slash n, `a,b,c`, or a single
// value) into the set of allowed numbers in [min, max].
function expandField(spec: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const step = part.includes("/") ? Number(part.split("/")[1]) : 1;
    const head = part.split("/")[0];
    let lo = min;
    let hi = max;
    if (head !== "*") {
      if (head.includes("-")) {
        const [a, b] = head.split("-").map(Number);
        lo = a;
        hi = b;
      } else {
        lo = Number(head);
        hi = Number(head);
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(step) || step < 1) continue;
    for (let v = lo; v <= hi; v += step) {
      if (v >= min && v <= max) out.add(v);
    }
  }
  return out;
}

type CronFields = {
  minute: Set<number>;
  hour: Set<number>;
  dom: Set<number>;
  month: Set<number>;
  dow: Set<number>;
  domRestricted: boolean;
  dowRestricted: boolean;
};

function parseCron(cron: string): CronFields | null {
  const f = cron.trim().split(/\s+/);
  if (f.length !== 5) return null;
  return {
    minute: expandField(f[0], 0, 59),
    hour: expandField(f[1], 0, 23),
    dom: expandField(f[2], 1, 31),
    month: expandField(f[3], 1, 12),
    dow: expandField(f[4], 0, 6),
    domRestricted: f[2] !== "*",
    dowRestricted: f[4] !== "*",
  };
}

function matchesDate(fields: CronFields, d: Date): boolean {
  if (!fields.minute.has(d.getUTCMinutes())) return false;
  if (!fields.hour.has(d.getUTCHours())) return false;
  if (!fields.month.has(d.getUTCMonth() + 1)) return false;
  // Standard cron day semantics: when BOTH day-of-month and day-of-week are restricted, the run fires
  // if EITHER matches; when only one is restricted, it must match; when neither, any day passes.
  const domOk = fields.dom.has(d.getUTCDate());
  const dowOk = fields.dow.has(d.getUTCDay());
  if (fields.domRestricted && fields.dowRestricted) return domOk || dowOk;
  if (fields.domRestricted) return domOk;
  if (fields.dowRestricted) return dowOk;
  return true;
}

// A generous upper bound on the minute-by-minute search: 367 days covers every cron this parser emits
// (a monthly-on-the-31st run is the worst case, found within ~31 days). If exhausted the caller falls
// back to a fixed interval so a ritual can never get stuck with no next_run_at.
const SEARCH_CAP_MINUTES = 367 * 24 * 60;

export type CronNextOpts = {
  /** Bi-weekly spacing (SPEC §7): the cron gives the weekly occurrence; this skips every other one,
   *  anchored to lastRunAt, so an "every other Wednesday" lands ~14 days apart. */
  biWeekly?: boolean;
  lastRunAt?: Date | null;
};

/**
 * The next fire time strictly after `from` for a 5-field cron, or null if the cron is unparseable.
 * Computed in UTC. Bi-weekly rituals skip to the following matching day when the naive next occurrence
 * would fall less than 10 days after the last run.
 */
export function cronNextRun(cron: string, from: Date, opts: CronNextOpts = {}): Date | null {
  const fields = parseCron(cron);
  if (!fields) return null;

  // Start at the next whole minute after `from`.
  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

  let next = stepToMatch(fields, cursor);
  if (!next) return null;

  if (opts.biWeekly && opts.lastRunAt) {
    const minGap = 10 * DAY_MS;
    let guard = 0;
    while (next && next.getTime() - opts.lastRunAt.getTime() < minGap && guard < 60) {
      const after = new Date(next.getTime());
      after.setUTCMinutes(after.getUTCMinutes() + 1);
      next = stepToMatch(fields, after);
      guard += 1;
    }
  }
  return next;
}

function stepToMatch(fields: CronFields, start: Date): Date | null {
  const cursor = new Date(start.getTime());
  for (let i = 0; i < SEARCH_CAP_MINUTES; i += 1) {
    if (matchesDate(fields, cursor)) return new Date(cursor.getTime());
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return null;
}

/** The next `n` fire times after `from` — the create flow's "Next N runs" preview (SPEC §4.2). */
export function nextRuns(cron: string, n: number, from: Date = new Date(), opts: CronNextOpts = {}): Date[] {
  const out: Date[] = [];
  let cursor = from;
  let lastRunAt = opts.lastRunAt ?? null;
  for (let i = 0; i < n; i += 1) {
    const next = cronNextRun(cron, cursor, { biWeekly: opts.biWeekly, lastRunAt });
    if (!next) break;
    out.push(next);
    cursor = next;
    lastRunAt = next; // bi-weekly anchors each subsequent run to the previous one
  }
  return out;
}
