// reply-stripper.ts — strip the quoted reply chain off a forwarded/replied email so the Capture
// Inbox stores the meaningful body, not the whole thread history. Pure + dependency-free (rolled
// instead of pulling email-reply-parser, per the no-new-SDK ethos) → directly unit-tested against
// the Gmail, Apple Mail, and Outlook reply formats.
//
// We cut the body at the FIRST quoted-reply marker we see, then trim dangling blank / quoted lines.
// We deliberately do NOT cut at "---------- Forwarded message ----------": forwarding a message to
// the capture address IS the capture, so the forwarded body is content to keep, not chrome to drop.

const ATTRIBUTION_LINE = /^\s*On\b.*\bwrote:\s*$/; // single-line "On <date> <name> <addr> wrote:"
const ATTRIBUTION_START = /^\s*On\b/; // wrapped attribution whose "wrote:" lands a line or two later
const ORIGINAL_MESSAGE = /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i; // Outlook / older clients
const OUTLOOK_DIVIDER = /^\s*_{10,}\s*$/; // long underscore rule above an Outlook From:/Sent: block
const HEADER_FROM = /^\s*(From|De|Von|От):\s.+$/i; // localized "From:" header that opens a quoted block
const QUOTED_LINE = /^\s*>+/;

/** True when the next couple of lines complete an "On … wrote:" attribution that wrapped. */
function isWrappedAttribution(lines: string[], i: number): boolean {
  if (!ATTRIBUTION_START.test(lines[i]) || lines[i].includes("wrote:")) return false;
  const window = [lines[i], lines[i + 1] ?? "", lines[i + 2] ?? ""].join(" ");
  return /\bwrote:/.test(window);
}

/** True when an Outlook underscore divider is immediately followed by a quoted-header block. */
function isOutlookHeaderBlock(lines: string[], i: number): boolean {
  if (!OUTLOOK_DIVIDER.test(lines[i])) return false;
  return HEADER_FROM.test(lines[i + 1] ?? "") || HEADER_FROM.test(lines[i + 2] ?? "");
}

/**
 * Remove the quoted reply chain from an email body. Returns the trimmed remaining text; if the
 * whole body was a bare quoted reply (only `>` lines), the quote markers are unwrapped so the
 * content stays readable rather than collapsing to empty.
 */
export function stripQuotedReply(raw: string): string {
  if (!raw) return "";
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      ATTRIBUTION_LINE.test(line) ||
      ORIGINAL_MESSAGE.test(line) ||
      isWrappedAttribution(lines, i) ||
      isOutlookHeaderBlock(lines, i)
    ) {
      cut = i;
      break;
    }
  }

  const kept = lines.slice(0, cut);

  // If everything that remains is itself quoted (a reply that's nothing but the quote), unwrap the
  // `>` markers rather than collapsing to empty. Checked BEFORE the trailing trim, which would
  // otherwise strip the only content there is.
  const onlyQuoted =
    kept.some((l) => QUOTED_LINE.test(l)) && kept.every((l) => l.trim() === "" || QUOTED_LINE.test(l));
  if (onlyQuoted) {
    return kept.map((l) => l.replace(/^\s*>+\s?/, "")).join("\n").trim();
  }

  // Otherwise trim trailing blanks and any dangling quoted lines left above the cut.
  while (kept.length > 0) {
    const last = kept[kept.length - 1];
    if (last.trim() === "" || QUOTED_LINE.test(last)) kept.pop();
    else break;
  }

  return kept.join("\n").trim();
}
