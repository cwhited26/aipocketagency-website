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
  AttachDomainInputSchema,
  verifyVercelToken,
} from "../actions";
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
  it("exposes all five actions", () => {
    expect(VERCEL_ACTIONS.map((a) => a.action).sort()).toEqual([
      "attachDomain",
      "createProject",
      "getDeploymentStatus",
      "setEnvVar",
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
