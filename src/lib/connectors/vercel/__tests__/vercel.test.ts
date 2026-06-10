// Unit tests for the Vercel build connector. Pure surfaces (registry, gates, schemas, the
// never-auto-approve invariant for attach_domain) run with no network; the action execute() paths
// run against a mocked global fetch so the request shape + error mapping + secret-redaction are
// pinned without touching Vercel. The attach_domain Infinity-window invariant is pinned here so a
// future edit can't silently let a domain attach become auto-approve eligible.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  VERCEL_ACTIONS,
  VERCEL_WRITE_ACTIONS,
  isVercelAction,
  isVercelReadOnly,
  vercelActionGate,
  executeVercelAction,
} from "../index";
import {
  CreateProjectInputSchema,
  SetEnvVarInputSchema,
  SetEnvVarsInputSchema,
  AttachDomainInputSchema,
  verifyVercelToken,
} from "../actions";
import { encrypt } from "@/lib/crypto/encrypt";
import { autoApproveUnlockedFor, connectorActionTrustWindow } from "@/lib/orchestrator/tier-caps";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

describe("registry", () => {
  it("exposes all six actions", () => {
    expect(VERCEL_ACTIONS.map((a) => a.action).sort()).toEqual([
      "attachDomain",
      "createProject",
      "getDeploymentStatus",
      "setEnvVar",
      "setEnvVars",
      "triggerDeploy",
    ]);
  });

  it("classifies reads vs writes", () => {
    expect(isVercelReadOnly("getDeploymentStatus")).toBe(true);
    expect(isVercelReadOnly("createProject")).toBe(false);
    expect([...VERCEL_WRITE_ACTIONS].sort()).toEqual([
      "attachDomain",
      "createProject",
      "setEnvVar",
      "setEnvVars",
      "triggerDeploy",
    ]);
  });

  it("recognizes known actions only", () => {
    expect(isVercelAction("createProject")).toBe(true);
    expect(isVercelAction("deleteEverything")).toBe(false);
  });

  it("gates: read is read, writes are gated", () => {
    expect(vercelActionGate("getDeploymentStatus")).toBe("read");
    expect(vercelActionGate("createProject")).toBe("gated");
    expect(vercelActionGate("attachDomain")).toBe("gated");
  });
});

describe("attach_domain never auto-approves (single-approval forever)", () => {
  it("has an unreachable trust window", () => {
    expect(connectorActionTrustWindow("vercel", "attach_domain")).toBe(Number.POSITIVE_INFINITY);
  });

  it("stays locked no matter how many approvals", () => {
    expect(autoApproveUnlockedFor("vercel", "attach_domain", 9_999)).toBe(false);
  });

  it("other vercel writes clear at the default window", () => {
    expect(connectorActionTrustWindow("vercel", "create_project")).toBe(10);
    expect(autoApproveUnlockedFor("vercel", "create_project", 10)).toBe(true);
  });
});

describe("schemas", () => {
  it("createProject rejects invalid names, accepts valid", () => {
    expect(CreateProjectInputSchema.safeParse({ name: "My Project" }).success).toBe(false);
    expect(CreateProjectInputSchema.safeParse({ name: "my-crm" }).success).toBe(true);
  });

  it("setEnvVar defaults to encrypted + all targets", () => {
    const parsed = SetEnvVarInputSchema.parse({ projectId: "p1", key: "DB_URL", value: "secret" });
    expect(parsed.encrypted).toBe(true);
    expect(parsed.target).toEqual(["production", "preview", "development"]);
  });

  it("attachDomain validates the domain shape", () => {
    expect(AttachDomainInputSchema.safeParse({ projectId: "p1", domain: "not a domain" }).success).toBe(false);
    expect(AttachDomainInputSchema.safeParse({ projectId: "p1", domain: "app.example.com" }).success).toBe(true);
  });

  it("setEnvVars accepts a vars array (value or value_encrypted), rejects a var with neither", () => {
    const ok = SetEnvVarsInputSchema.safeParse({
      projectId: "p1",
      vars: [
        { key: "NEXT_PUBLIC_SUPABASE_URL", value: "https://ref.supabase.co", encrypted: false },
        { key: "SUPABASE_SERVICE_ROLE_KEY", value_encrypted: "v1.x.y.z" },
      ],
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      // Defaults: encrypted true, all three targets.
      expect(ok.data.vars[1].encrypted).toBe(true);
      expect(ok.data.vars[1].target).toEqual(["production", "preview", "development"]);
    }
    const bad = SetEnvVarsInputSchema.safeParse({ projectId: "p1", vars: [{ key: "NOPE" }] });
    expect(bad.success).toBe(false);
    expect(SetEnvVarsInputSchema.safeParse({ projectId: "p1", vars: [] }).success).toBe(false);
  });
});

describe("execute (mocked fetch)", () => {
  it("createProject returns the new id + name on success", async () => {
    mockFetch(200, { id: "prj_123", name: "my-crm" });
    const r = await executeVercelAction("createProject", {
      token: "tok",
      teamId: null,
      payload: { name: "my-crm" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.projectId).toBe("prj_123");
      expect(r.data.projectName).toBe("my-crm");
    }
  });

  it("setEnvVar never echoes the secret value back", async () => {
    mockFetch(200, { created: { id: "env_1" } });
    const r = await executeVercelAction("setEnvVar", {
      token: "tok",
      teamId: null,
      payload: { projectId: "prj_1", key: "DB_URL", value: "super-secret" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(JSON.stringify(r.data)).not.toContain("super-secret");
      expect(r.data.key).toBe("DB_URL");
    }
  });

  it("setEnvVars posts the full array and never echoes any value", async () => {
    const spy = vi.fn(async (_url: string, init: RequestInit) => {
      void init;
      return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", spy);
    const r = await executeVercelAction("setEnvVars", {
      token: "tok",
      teamId: null,
      payload: {
        projectId: "prj_1",
        vars: [
          { key: "NEXT_PUBLIC_SUPABASE_URL", value: "https://ref.supabase.co", encrypted: false },
          { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: "anon-public", encrypted: false },
        ],
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.keys).toEqual(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
      expect(JSON.stringify(r.data)).not.toContain("anon-public");
    }
    // The request body is the array of env objects.
    const body = JSON.parse(spy.mock.calls[0][1].body as string);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].type).toBe("plain");
  });

  it("setEnvVars decrypts a value_encrypted secret at execution and never leaks it", async () => {
    const prev = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    try {
      const sealed = encrypt("service-role-secret");
      const spy = vi.fn(async (_url: string, init: RequestInit) => {
        void init;
        return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
      });
      vi.stubGlobal("fetch", spy);
      const r = await executeVercelAction("setEnvVars", {
        token: "tok",
        teamId: null,
        payload: {
          projectId: "prj_1",
          vars: [{ key: "SUPABASE_SERVICE_ROLE_KEY", value_encrypted: sealed, encrypted: true }],
        },
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(JSON.stringify(r.data)).not.toContain("service-role-secret");
      // The decrypted secret reaches Vercel (encrypted at rest there), but never our result payload.
      const body = JSON.parse(spy.mock.calls[0][1].body as string);
      expect(body[0].value).toBe("service-role-secret");
      expect(body[0].type).toBe("encrypted");
    } finally {
      if (prev === undefined) delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
      else process.env.GMAIL_TOKEN_ENCRYPTION_KEY = prev;
    }
  });

  it("maps a 403 to an auth error", async () => {
    mockFetch(403, { error: { code: "forbidden", message: "Not authorized" } });
    const r = await executeVercelAction("createProject", {
      token: "bad",
      teamId: null,
      payload: { name: "x" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.authError).toBe(true);
      expect(r.error).toContain("Not authorized");
    }
  });

  it("invalid payload fails before any fetch", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const r = await executeVercelAction("attachDomain", {
      token: "tok",
      teamId: null,
      payload: { projectId: "p1", domain: "nope" },
    });
    expect(r.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("verifyVercelToken", () => {
  it("resolves the identity on success", async () => {
    mockFetch(200, { user: { username: "chase", email: "c@example.com" } });
    const r = await verifyVercelToken("tok", null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.identity.username).toBe("chase");
  });

  it("reports a rejected token clearly", async () => {
    mockFetch(403, { error: { code: "forbidden", message: "bad token" } });
    const r = await verifyVercelToken("tok", null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });
});
