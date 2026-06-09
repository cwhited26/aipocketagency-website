// connectors/supabase/types.ts — shared action vocabulary + result shapes for the Supabase Build
// Connector. Kept SDK-free: every call is direct REST against the Supabase Management API
// (https://api.supabase.com/v1) — see ./api.ts.

export const SUPABASE_CONNECTOR = "supabase";

export type SupabaseActionName =
  | "create_project"
  | "apply_migration"
  | "seed_data"
  | "run_sql_read_only"
  | "get_connection_string";

// "read"         — runs inline, no approval, audit-logged.
// "gated"        — stages to the Approval Inbox; can earn an auto-approve trust window.
// "always_gated" — stages to the Approval Inbox and NEVER becomes auto-approve-eligible
//                  (apply_migration: irreversible data-layer change, single-approval forever).
export type ApprovalGate = "read" | "gated" | "always_gated";

export type SupabaseActionMeta = {
  name: SupabaseActionName;
  connector: typeof SUPABASE_CONNECTOR;
  description: string;
  gate: ApprovalGate;
};

// Normalized terminal outcome of one action against the Management API. `authError` flips the
// connection to status='error' so the owner is prompted to re-paste their token.
export type ActionExecOutcome =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; authError: boolean };
