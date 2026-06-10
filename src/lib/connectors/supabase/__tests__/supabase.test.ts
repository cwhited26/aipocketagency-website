import { afterEach, describe, it, expect, vi } from "vitest";
import { assertReadOnlySql, destructiveSqlWarnings } from "../sql-guard";
import {
  SUPABASE_ACTIONS,
  isSupabaseAction,
  isSupabaseReadOnly,
  isSupabaseNeverAutoApprove,
  supabaseActionGate,
} from "../index";
import { getProjectApiKeys } from "../api";
import { autoApproveUnlockedFor } from "@/lib/orchestrator/tier-caps";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("assertReadOnlySql", () => {
  it("accepts a plain SELECT", () => {
    const r = assertReadOnlySql("SELECT id, email FROM users WHERE active = true");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized).toContain("SELECT");
  });

  it("accepts a WITH (CTE) that resolves to a SELECT", () => {
    const r = assertReadOnlySql("WITH recent AS (SELECT * FROM orders LIMIT 10) SELECT * FROM recent");
    expect(r.ok).toBe(true);
  });

  it("accepts a SELECT whose column names embed forbidden words (created_at, updated_at)", () => {
    const r = assertReadOnlySql("SELECT created_at, updated_at, deleted_flag FROM rows");
    expect(r.ok).toBe(true);
  });

  for (const verb of [
    "INSERT INTO t VALUES (1)",
    "UPDATE t SET x = 1",
    "DELETE FROM t",
    "DROP TABLE t",
    "ALTER TABLE t ADD COLUMN x int",
    "CREATE TABLE t (id int)",
    "TRUNCATE t",
    "GRANT ALL ON t TO anon",
    "REVOKE ALL ON t FROM anon",
  ]) {
    it(`rejects: ${verb}`, () => {
      const r = assertReadOnlySql(verb);
      expect(r.ok).toBe(false);
    });
  }

  it("rejects a data-modifying CTE (WITH ... DELETE ... RETURNING)", () => {
    const r = assertReadOnlySql(
      "WITH gone AS (DELETE FROM users WHERE id = 1 RETURNING *) SELECT * FROM gone",
    );
    expect(r.ok).toBe(false);
  });

  it("rejects a multi-statement payload (SELECT; DROP)", () => {
    const r = assertReadOnlySql("SELECT 1; DROP TABLE users");
    expect(r.ok).toBe(false);
  });

  it("rejects a forbidden verb hidden behind a comment", () => {
    const r = assertReadOnlySql("SELECT 1 /* */; DELETE FROM users --");
    expect(r.ok).toBe(false);
  });

  it("rejects an empty / comment-only query", () => {
    expect(assertReadOnlySql("").ok).toBe(false);
    expect(assertReadOnlySql("-- just a comment").ok).toBe(false);
  });
});

describe("destructiveSqlWarnings", () => {
  it("warns on DELETE and UPDATE in a seed body", () => {
    const w = destructiveSqlWarnings("DELETE FROM seed; INSERT INTO seed VALUES (1); UPDATE seed SET x=1");
    expect(w.some((s) => s.includes("DELETE"))).toBe(true);
    expect(w.some((s) => s.includes("UPDATE"))).toBe(true);
  });

  it("is silent for a pure INSERT seed", () => {
    expect(destructiveSqlWarnings("INSERT INTO seed (a) VALUES (1), (2)")).toEqual([]);
  });
});

describe("action policy", () => {
  it("registers exactly the five roadmap actions", () => {
    const names = SUPABASE_ACTIONS.map((a) => a.name).sort();
    expect(names).toEqual(
      ["apply_migration", "create_project", "get_connection_string", "run_sql_read_only", "seed_data"].sort(),
    );
  });

  it("treats the two read actions as read-only (no approval)", () => {
    expect(isSupabaseReadOnly("run_sql_read_only")).toBe(true);
    expect(isSupabaseReadOnly("get_connection_string")).toBe(true);
    expect(isSupabaseReadOnly("create_project")).toBe(false);
  });

  it("never lets apply_migration earn auto-approve, no matter the count", () => {
    expect(isSupabaseNeverAutoApprove("apply_migration")).toBe(true);
    expect(supabaseActionGate("apply_migration")).toBe("always_gated");
    expect(autoApproveUnlockedFor("supabase", "apply_migration", 1_000_000)).toBe(false);
  });

  it("lets create_project / seed_data unlock after the default trust window", () => {
    expect(autoApproveUnlockedFor("supabase", "create_project", 10)).toBe(true);
    expect(autoApproveUnlockedFor("supabase", "seed_data", 10)).toBe(true);
    expect(autoApproveUnlockedFor("supabase", "create_project", 9)).toBe(false);
  });

  it("recognizes only known actions", () => {
    expect(isSupabaseAction("create_project")).toBe(true);
    expect(isSupabaseAction("delete_project")).toBe(false);
  });
});

describe("getProjectApiKeys (mocked fetch)", () => {
  function mockFetch(status: number, body: unknown): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })),
    );
  }

  it("reads the anon + service_role keys from the api-keys array", async () => {
    mockFetch(200, [
      { name: "anon", api_key: "anon-key-123" },
      { name: "service_role", api_key: "service-key-456" },
    ]);
    const r = await getProjectApiKeys("pat", "ref123");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.anonKey).toBe("anon-key-123");
      expect(r.data.serviceRoleKey).toBe("service-key-456");
    }
  });

  it("returns null keys when the project is still coming up (empty list)", async () => {
    mockFetch(200, []);
    const r = await getProjectApiKeys("pat", "ref123");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.anonKey).toBeNull();
      expect(r.data.serviceRoleKey).toBeNull();
    }
  });

  it("flags a 401 as an auth error", async () => {
    mockFetch(401, { message: "unauthorized" });
    const r = await getProjectApiKeys("bad", "ref123");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.authError).toBe(true);
  });
});
