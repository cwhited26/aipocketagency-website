// leads.ts — extract a contact (email / phone / name) from a free-text visitor message
// (SPEC v3 §9 Mode B "Lead capture extraction"). The primary capture is the pre-chat
// form; this is the in-conversation fallback ("my email is X", "call me at Y"). Pure +
// deterministic so it is unit-tested with positive AND negative cases
// (__tests__/leads.test.ts) — no model call, which keeps capture cheap and predictable
// on every anonymous turn.

// Email: the brief's required regex, bounded to avoid catastrophic backtracking.
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;

// Phone: 7–15 digits allowing the usual separators + an optional leading + or "(".
// Requires enough digits that we don't capture an order number or a year.
const PHONE_RE = /(?:\+?\(?\d[\d\s().-]{5,}\d)/;

// Intent phrases that precede a contact value ("my email is", "reach me at", "call me on").
const EMAIL_INTENT_RE =
  /(?:my\s+e-?mail(?:\s+address)?\s+is|e-?mail(?:\s+me)?(?:\s+at)?\s*:?|reach\s+me\s+at|contact\s+me\s+at|you\s+can\s+(?:reach|email)\s+me\s+(?:at|on))\s+([\w.+-]+@[\w-]+\.[\w.-]+)/i;

const PHONE_INTENT_RE =
  /(?:my\s+(?:phone|number|cell|mobile|tel)(?:\s+number)?\s+is|call\s+me\s+(?:at|on)|reach\s+me\s+(?:at|on)|text\s+me\s+at|phone\s*:?)\s*(\+?\(?\d[\d\s().-]{5,}\d)/i;

// Name intent. Deliberately conservative: only fires on an explicit self-introduction so
// we don't mis-capture a sentence subject. The intro words are matched case-insensitively
// (via leading-letter classes) while the name itself stays capitalized to avoid grabbing
// a lowercase sentence subject. Captures 1–3 capitalized tokens.
const NAME_INTENT_RE =
  /(?:[Mm]y\s+name\s+is|[Tt]his\s+is|[Ii]\s+am|[Ii]'?m)\s+([A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+){0,2})\b/;

// Words that follow "I'm" / "I am" but are NOT names — guards the name heuristic against
// "I'm interested", "I am looking", etc.
const NON_NAME_FOLLOWERS = new Set([
  "interested",
  "looking",
  "trying",
  "here",
  "ready",
  "wondering",
  "calling",
  "writing",
  "reaching",
  "not",
  "a",
  "an",
  "the",
  "going",
  "happy",
  "sorry",
  "from",
  "with",
]);

export type ExtractedLead = {
  email: string | null;
  phone: string | null;
  name: string | null;
};

function cleanPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  const digitCount = digits.replace(/\D/g, "").length;
  if (digitCount < 7 || digitCount > 15) return null;
  return digits;
}

function extractName(text: string): string | null {
  const m = NAME_INTENT_RE.exec(text);
  if (!m) return null;
  const candidate = m[1].trim();
  const first = candidate.split(/\s+/)[0]?.toLowerCase();
  if (!first || NON_NAME_FOLLOWERS.has(first)) return null;
  return candidate;
}

/**
 * Extracts whatever contact fields are present in one message. Intent phrases
 * ("my email is X") win over a bare match. Returns nulls when nothing is found — the
 * caller only persists a lead when at least one field is non-null.
 */
export function extractLeadFromText(text: string): ExtractedLead {
  const intentEmail = EMAIL_INTENT_RE.exec(text)?.[1] ?? null;
  const email = intentEmail ?? EMAIL_RE.exec(text)?.[0] ?? null;

  const intentPhone = PHONE_INTENT_RE.exec(text)?.[1] ?? null;
  const rawPhone = intentPhone ?? PHONE_RE.exec(text)?.[0] ?? null;
  // Only trust a bare (non-intent) phone match when there's an email too — a lone number
  // in prose is too noisy to capture on its own.
  const phone =
    intentPhone !== null
      ? cleanPhone(intentPhone)
      : email && rawPhone
        ? cleanPhone(rawPhone)
        : null;

  return {
    email: email ? email.toLowerCase() : null,
    phone,
    name: extractName(text),
  };
}

/** True when an extracted lead carries at least one usable field. */
export function hasLeadSignal(lead: ExtractedLead): boolean {
  return Boolean(lead.email || lead.phone || lead.name);
}
