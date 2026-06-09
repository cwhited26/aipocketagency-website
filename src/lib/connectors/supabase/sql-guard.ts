// connectors/supabase/sql-guard.ts — the read-only SQL allowlist + the destructive-SQL warning
// detector. PURE, no I/O, exhaustively unit-tested (./__tests__/supabase.test.ts) because this is
// the security boundary: runSqlReadOnly MUST reject anything that can mutate the owner's database
// BEFORE the call ever leaves the process.
//
// Design: fail-closed allowlist, not a blocklist.
//   1. Strip comments (a `-- DROP` or /* DELETE */ must not smuggle past the keyword scan, and a
//      comment must not let a second statement hide).
//   2. Exactly one statement — no `SELECT 1; DROP TABLE users` multi-statement payloads.
//   3. The statement must START with SELECT or WITH (a read or a CTE that resolves to a read).
//   4. No forbidden keyword anywhere as a whole word — defense in depth against a data-modifying
//      CTE (`WITH x AS (DELETE ... RETURNING *) SELECT ...`) that step 3 alone would miss.
//
// A SELECT whose string literal happens to contain the word "update" is rejected too. That is the
// correct trade for a security boundary: a false reject costs the owner a rephrase; a false accept
// costs them their data.

// The verbs the roadmap names explicitly, plus the obvious siblings (any statement that writes,
// changes structure, or moves privileges). Whole-word, case-insensitive.
const FORBIDDEN_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "CREATE",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  // Siblings that also mutate / escalate — not in the roadmap's literal list but the same class.
  "MERGE",
  "REPLACE",
  "UPSERT",
  "COPY",
  "CALL",
  "VACUUM",
  "REINDEX",
  "REFRESH",
  "COMMENT",
  "SECURITY",
] as const;

const FORBIDDEN_RE = new RegExp(`\\b(${FORBIDDEN_KEYWORDS.join("|")})\\b`, "i");

export type SqlGuardResult = { ok: true; normalized: string } | { ok: false; reason: string };

// Built via new RegExp (not literals) so the `*/` inside the block-comment pattern can't confuse a
// source tokenizer reading this file.
const BLOCK_COMMENT_RE = new RegExp("/\\*[\\s\\S]*?\\*/", "g");
const LINE_COMMENT_RE = new RegExp("--[^\\n\\r]*", "g");

/** Remove line and block SQL comments so they can't hide a second statement or a forbidden verb. */
function stripComments(sql: string): string {
  return sql.replace(BLOCK_COMMENT_RE, " ").replace(LINE_COMMENT_RE, " ");
}

/** Split on top-level semicolons and drop empties — used to enforce a single statement. */
function statements(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Assert `sql` is a single read-only statement. Returns the normalized (comment-stripped,
 * trimmed) query on success, or a human-readable reason on rejection. Callers MUST send only the
 * normalized string returned here — never the raw input.
 */
export function assertReadOnlySql(rawSql: string): SqlGuardResult {
  if (typeof rawSql !== "string" || rawSql.trim().length === 0) {
    return { ok: false, reason: "Query is empty." };
  }

  const stripped = stripComments(rawSql).trim();
  if (stripped.length === 0) {
    return { ok: false, reason: "Query is only comments — nothing to run." };
  }

  const stmts = statements(stripped);
  if (stmts.length === 0) {
    return { ok: false, reason: "Query is empty after removing comments." };
  }
  if (stmts.length > 1) {
    return {
      ok: false,
      reason: "Only a single SELECT statement is allowed — multiple statements are blocked.",
    };
  }

  const stmt = stmts[0];
  const firstWord = stmt.match(/^[a-z]+/i)?.[0].toUpperCase() ?? "";
  if (firstWord !== "SELECT" && firstWord !== "WITH") {
    return {
      ok: false,
      reason: `Read-only queries must start with SELECT or WITH (got ${firstWord || "an unknown token"}).`,
    };
  }

  const forbidden = stmt.match(FORBIDDEN_RE);
  if (forbidden) {
    return {
      ok: false,
      reason: `This query is read-only — the keyword "${forbidden[1].toUpperCase()}" is not allowed.`,
    };
  }

  return { ok: true, normalized: stmt };
}

/**
 * Inspect a seed/migration SQL body and return human-readable warnings for any destructive verb it
 * contains (DELETE / UPDATE / TRUNCATE / DROP). seedData is approval-gated, not blocked — the
 * owner may legitimately seed by clearing a table first — so this drives the approval card's
 * "heads up, this also deletes/updates rows" banner rather than a rejection. Whole-word, deduped.
 */
export function destructiveSqlWarnings(sql: string): string[] {
  if (typeof sql !== "string" || sql.trim().length === 0) return [];
  const body = stripComments(sql);
  const checks: { verb: string; re: RegExp; warn: string }[] = [
    { verb: "DELETE", re: /\bDELETE\b/i, warn: "removes existing rows (DELETE)" },
    { verb: "UPDATE", re: /\bUPDATE\b/i, warn: "changes existing rows (UPDATE)" },
    { verb: "TRUNCATE", re: /\bTRUNCATE\b/i, warn: "empties a table (TRUNCATE)" },
    { verb: "DROP", re: /\bDROP\b/i, warn: "drops a database object (DROP)" },
  ];
  const out: string[] = [];
  for (const c of checks) {
    if (c.re.test(body)) out.push(c.warn);
  }
  return out;
}
