// operator.ts — who counts as an operator (Chase / the team) for the internal admin surfaces.
//
// Pocket Agent has no role column yet; the operator set is an allowlist of email addresses. PA_OPERATOR_EMAILS
// is a comma-separated env override; it falls back to the known operator address so the admin views work
// out of the box without an extra env in dev. Pure + case-insensitive so routes can gate on it directly.

const DEFAULT_OPERATOR_EMAILS = ["cwhited94@gmail.com"];

/** The configured operator email allowlist, lower-cased. Env override wins; default is the known operator. */
export function operatorEmails(): string[] {
  const raw = process.env.PA_OPERATOR_EMAILS;
  const list = raw
    ? raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0)
    : DEFAULT_OPERATOR_EMAILS;
  return list.map((e) => e.toLowerCase());
}

/** Is this email an operator (Chase / team)? Case-insensitive; null/empty is never an operator. */
export function isOperatorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return operatorEmails().includes(email.trim().toLowerCase());
}
