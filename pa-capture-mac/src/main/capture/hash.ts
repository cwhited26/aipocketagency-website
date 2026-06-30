// Pure content hashing + dedup for captured items. SHA-256 over (kind, content, filename) gives a
// stable key: identical content of the same kind collapses to one capture, so a clipboard poll that
// re-reads the same value, or two screenshots of the same bytes, never queue twice. No Electron
// imports → directly unit-tested.

import { createHash } from "node:crypto";
import type { CaptureKind } from "../../shared/types";

/** NUL is used as the field separator so boundaries are unambiguous: ("ab","") can't collide with
 *  ("a","b"). NUL never appears in clipboard text or base64 content, so it's a safe delimiter. */
const SEP = String.fromCharCode(0); // NUL field separator

export interface HashInput {
  kind: CaptureKind;
  /** Raw text for text/url; base64 of the bytes for image/file. */
  content: string;
  filename?: string | null;
}

/** SHA-256 (hex) of a capture's identity over (kind, content, filename). */
export function computeContentHash(input: HashInput): string {
  return createHash("sha256")
    .update(input.kind)
    .update(SEP)
    .update(input.content)
    .update(SEP)
    .update(input.filename ?? "")
    .digest("hex");
}

/** True when `hash` is already present in the set of seen hashes. */
export function isDuplicateHash(hash: string, seen: ReadonlySet<string>): boolean {
  return seen.has(hash);
}
