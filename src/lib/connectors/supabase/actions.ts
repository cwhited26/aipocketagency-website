// connectors/supabase/actions.ts — the five Supabase Build Connector actions (roadmap §7.3).
// Each action validates its payload (zod), calls the direct-REST Management API client (./api.ts),
// and returns a normalized ActionExecOutcome. No SDK, no silent catch, no `any`.
//
//   createProject        — gated.        Provisions a new project in the owner's org.
//   applyMigration       — always_gated. SINGLE-APPROVAL FOREVER (irreversible schema change);
//                          the approval card shows the FULL SQL.
//   seedData             — gated.         Inserts/loads rows; the card warns when the SQL also
//                          DELETEs/UPDATEs/TRUNCATEs.
//   runSqlReadOnly       — read.          REJECTS anything that isn't a single SELECT/WITH at parse
//                          time (sql-guard) BEFORE the call leaves the process.
//   getConnectionString  — read.          Returns the project's connection string (host is logged,
//                          the password placeholder is never a real secret).

import { z } from "zod";
import type { ActionExecOutcome } from "./types";
import {
  createProject as mgmtCreateProject,
  getProject as mgmtGetProject,
  runQuery as mgmtRunQuery,
} from "./api";
import { assertReadOnlySql, destructiveSqlWarnings } from "./sql-guard";

// ── create_project ────────────────────────────────────────────────────────────────────────────
export const CreateProjectInputSchema = z.object({
  // Optional — index.ts fills the owner's default org when absent.
  org_id: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  region: z.string().min(1).max(40).default("us-east-1"),
  db_pass: z.string().min(12, "Database password must be at least 12 characters."),
  plan: z.enum(["free", "pro"]).default("free"),
  // Optional link back to the PA Project this build belongs to — when present, a successful
  // create records the ref to that project's workspace ledger (pa_project_workspaces).
  project_id: z.string().uuid().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export async function executeCreateProject(args: {
  pat: string;
  input: CreateProjectInput & { org_id: string };
}): Promise<ActionExecOutcome> {
  const r = await mgmtCreateProject(args.pat, {
    organizationId: args.input.org_id,
    name: args.input.name,
    region: args.input.region,
    dbPass: args.input.db_pass,
    plan: args.input.plan,
  });
  if (!r.ok) return { ok: false, status: r.status, error: r.error, authError: r.authError };
  return {
    ok: true,
    summary: `Created Supabase project "${r.data.name}" (${r.data.ref}) in ${r.data.region || "the default region"}.`,
    data: {
      projectRef: r.data.ref,
      projectName: r.data.name,
      region: r.data.region,
      status: r.data.status,
      organizationId: r.data.organizationId || args.input.org_id,
    },
  };
}

// ── apply_migration ───────────────────────────────────────────────────────────────────────────
export const ApplyMigrationInputSchema = z.object({
  project_ref: z.string().min(1),
  sql: z.string().min(1, "Migration SQL is required."),
});
export type ApplyMigrationInput = z.infer<typeof ApplyMigrationInputSchema>;

export async function executeApplyMigration(args: {
  pat: string;
  input: ApplyMigrationInput;
}): Promise<ActionExecOutcome> {
  const r = await mgmtRunQuery(args.pat, args.input.project_ref, args.input.sql);
  if (!r.ok) return { ok: false, status: r.status, error: r.error, authError: r.authError };
  return {
    ok: true,
    summary: `Applied migration to ${args.input.project_ref} (${r.data.length} row(s) returned).`,
    data: { projectRef: args.input.project_ref, rows: r.data.length },
  };
}

// ── seed_data ─────────────────────────────────────────────────────────────────────────────────
export const SeedDataInputSchema = z.object({
  project_ref: z.string().min(1),
  sql: z.string().min(1, "Seed SQL is required."),
});
export type SeedDataInput = z.infer<typeof SeedDataInputSchema>;

export async function executeSeedData(args: {
  pat: string;
  input: SeedDataInput;
}): Promise<ActionExecOutcome> {
  const r = await mgmtRunQuery(args.pat, args.input.project_ref, args.input.sql);
  if (!r.ok) return { ok: false, status: r.status, error: r.error, authError: r.authError };
  return {
    ok: true,
    summary: `Seeded data into ${args.input.project_ref} (${r.data.length} row(s) returned).`,
    data: { projectRef: args.input.project_ref, rows: r.data.length },
  };
}

// ── run_sql_read_only ─────────────────────────────────────────────────────────────────────────
export const RunSqlReadOnlyInputSchema = z.object({
  project_ref: z.string().min(1),
  query: z.string().min(1, "Query is required."),
});
export type RunSqlReadOnlyInput = z.infer<typeof RunSqlReadOnlyInputSchema>;

const MAX_RETURNED_ROWS = 200;

export async function executeRunSqlReadOnly(args: {
  pat: string;
  input: RunSqlReadOnlyInput;
}): Promise<ActionExecOutcome> {
  // Parse-time allowlist — reject any non-SELECT BEFORE the call leaves the process.
  const guard = assertReadOnlySql(args.input.query);
  if (!guard.ok) {
    return { ok: false, status: 422, error: guard.reason, authError: false };
  }
  const r = await mgmtRunQuery(args.pat, args.input.project_ref, guard.normalized);
  if (!r.ok) return { ok: false, status: r.status, error: r.error, authError: r.authError };
  const rows = r.data.slice(0, MAX_RETURNED_ROWS);
  return {
    ok: true,
    summary: `Read ${r.data.length} row(s) from ${args.input.project_ref}.`,
    data: {
      projectRef: args.input.project_ref,
      rowCount: r.data.length,
      truncated: r.data.length > MAX_RETURNED_ROWS,
      rows,
    },
  };
}

// ── get_connection_string ─────────────────────────────────────────────────────────────────────
export const GetConnectionStringInputSchema = z.object({
  project_ref: z.string().min(1),
});
export type GetConnectionStringInput = z.infer<typeof GetConnectionStringInputSchema>;

export async function executeGetConnectionString(args: {
  pat: string;
  input: GetConnectionStringInput;
}): Promise<ActionExecOutcome> {
  const r = await mgmtGetProject(args.pat, args.input.project_ref);
  if (!r.ok) return { ok: false, status: r.status, error: r.error, authError: r.authError };
  const host = r.data.databaseHost ?? `db.${args.input.project_ref}.supabase.co`;
  // The password is the db_pass the owner set at createProject — PA never stores it — so the
  // string carries a placeholder, not a real secret. The audit summary logs only the host.
  const connectionString = `postgresql://postgres:[YOUR-PASSWORD]@${host}:5432/postgres`;
  return {
    ok: true,
    summary: `Connection host for ${args.input.project_ref}: ${host}`,
    data: {
      projectRef: args.input.project_ref,
      host,
      port: 5432,
      database: "postgres",
      user: "postgres",
      connectionString,
      note: "Replace [YOUR-PASSWORD] with the database password you set when the project was created.",
    },
  };
}
