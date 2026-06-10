// connectors/vercel/actions.ts — the five Vercel build actions, direct REST against
// https://api.vercel.com (no Vercel SDK). Each action is a self-contained descriptor: a zod input
// schema + an execute() that makes the HTTP call and maps the result to an ActionExecOutcome.
//
// Approval posture (Build Tools roadmap §7.2, §11):
//   • createProject  — gated; trust window applies.
//   • setEnvVar      — gated; trust window applies; the value is stored ENCRYPTED on Vercel.
//   • triggerDeploy  — gated; trust window applies.
//   • getDeploymentStatus — read-only; no approval needed.
//   • attachDomain   — gated, and SINGLE-APPROVAL FOREVER. Pointing a domain moves real DNS-routed
//     traffic, so it never becomes auto-approve-eligible regardless of count. The never-unlock rule
//     is enforced at the trust layer (tier-caps CONNECTOR_ACTION_TRUST_OVERRIDES['vercel:attach_domain']).
//
// Team scoping: a token can be personal or team-scoped. When the connection carries a team id it is
// threaded onto every call as ?teamId= so create/deploy target the owner's team, not personal scope.

import { z } from "zod";
import { decrypt } from "@/lib/crypto/encrypt";
import type { ActionExecOutcome, ApprovalGate, VercelActionName } from "./types";

const API_BASE = "https://api.vercel.com";

// ── Shared HTTP plumbing ─────────────────────────────────────────────────────────────────────

type VercelCallContext = {
  token: string;
  teamId: string | null;
};

/** Append ?teamId= when the token is team-scoped, preserving any existing query string. */
function withTeam(path: string, teamId: string | null): string {
  if (!teamId) return `${API_BASE}${path}`;
  const sep = path.includes("?") ? "&" : "?";
  return `${API_BASE}${path}${sep}teamId=${encodeURIComponent(teamId)}`;
}

type VercelResponse =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; error: string; authError: boolean };

/**
 * One Vercel API call. Returns a typed envelope — never throws on an HTTP error, and never a silent
 * catch (a network/parse failure is surfaced as status 502/500). 401/403 set authError so the
 * caller can flip the connection to a reconnect state.
 */
async function vercelFetch(
  ctx: VercelCallContext,
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): Promise<VercelResponse> {
  let res: Response;
  try {
    res = await fetch(withTeam(path, ctx.teamId), {
      method,
      headers: {
        Authorization: `Bearer ${ctx.token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      error: `Couldn't reach Vercel: ${e instanceof Error ? e.message : "network error"}`,
      authError: false,
    };
  }

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Non-JSON body on an otherwise-OK response is unexpected; treat as an error so nothing
      // downstream reads garbage. (Vercel returns JSON for every documented endpoint.)
      if (res.ok) {
        return { ok: false, status: 502, error: "Vercel returned a non-JSON response.", authError: false };
      }
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: vercelErrorMessage(parsed, res.status),
      authError: res.status === 401 || res.status === 403,
    };
  }
  return { ok: true, status: res.status, body: parsed };
}

/** Pull the human-readable message out of Vercel's `{ error: { code, message } }` envelope. */
function vercelErrorMessage(body: Record<string, unknown>, status: number): string {
  const err = body.error;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return `Vercel API error (HTTP ${status}).`;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

// ── Action descriptors ───────────────────────────────────────────────────────────────────────

export type VercelActionDescriptor<I> = {
  name: VercelActionName;
  action: VercelActionName;
  description: string;
  gate: ApprovalGate;
  schema: z.ZodType<I>;
  execute: (ctx: VercelCallContext, input: I) => Promise<ActionExecOutcome>;
};

// createProject — POST /v11/projects { name, framework?, gitRepository? }
export const CreateProjectInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9._-]+$/, "Project names use lowercase letters, digits, '.', '_' and '-' only."),
  framework: z.string().max(50).optional(),
  // owner/repo to link a GitHub repo (the one createRepo made in the GitHub Build lane).
  gitRepo: z.string().max(200).optional(),
  // The PA project this build belongs to — the executor writes the new Vercel id back to its
  // workspace row. Optional so a standalone createProject (no Project) still works.
  projectId: z.string().uuid().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const createProjectAction: VercelActionDescriptor<CreateProjectInput> = {
  name: "createProject",
  action: "createProject",
  description: "Create a new Vercel project on the owner's account (optionally linked to a GitHub repo).",
  gate: "gated",
  schema: CreateProjectInputSchema,
  async execute(ctx, input) {
    const body: Record<string, unknown> = { name: input.name };
    if (input.framework) body.framework = input.framework;
    if (input.gitRepo) body.gitRepository = { type: "github", repo: input.gitRepo };

    const res = await vercelFetch(ctx, "POST", "/v11/projects", body);
    if (!res.ok) return { ok: false, status: res.status, error: res.error, authError: res.authError };

    const id = str(res.body.id);
    const name = str(res.body.name) ?? input.name;
    if (!id) {
      return { ok: false, status: 502, error: "Vercel created the project but returned no id.", authError: false };
    }
    return {
      ok: true,
      summary: `Created Vercel project "${name}".`,
      data: { projectId: id, projectName: name },
    };
  },
};

// setEnvVar — POST /v10/projects/{id}/env { key, value, type, target }
export const SetEnvVarInputSchema = z.object({
  projectId: z.string().min(1).max(100),
  key: z.string().min(1).max(256),
  value: z.string().max(65_536),
  // Which environments the var applies to. Defaults to all three.
  target: z
    .array(z.enum(["production", "preview", "development"]))
    .min(1)
    .default(["production", "preview", "development"]),
  // Encrypted by default (PA-BUILD: secrets never land in plaintext). `plain` only when the owner
  // explicitly needs a non-secret build var.
  encrypted: z.boolean().default(true),
});
export type SetEnvVarInput = z.infer<typeof SetEnvVarInputSchema>;

export const setEnvVarAction: VercelActionDescriptor<SetEnvVarInput> = {
  name: "setEnvVar",
  action: "setEnvVar",
  description: "Set an environment variable on a Vercel project (encrypted by default).",
  gate: "gated",
  schema: SetEnvVarInputSchema,
  async execute(ctx, input) {
    const body = {
      key: input.key,
      value: input.value,
      type: input.encrypted ? "encrypted" : "plain",
      target: input.target,
    };
    const res = await vercelFetch(
      ctx,
      "POST",
      `/v10/projects/${encodeURIComponent(input.projectId)}/env`,
      body,
    );
    if (!res.ok) return { ok: false, status: res.status, error: res.error, authError: res.authError };

    return {
      ok: true,
      summary: `Set ${input.encrypted ? "encrypted " : ""}env var "${input.key}" on ${input.target.join(", ")}.`,
      // Never echo the value back — it's a secret. Only the key + scope.
      data: { key: input.key, target: input.target, encrypted: input.encrypted },
    };
  },
};

// setEnvVars — POST /v10/projects/{id}/env with an ARRAY body. One approval sets several vars in a
// single fire (the Idea Engine injects the three Supabase vars — URL, anon key, service role key —
// in one card rather than three). Each var is either plaintext (`value`) or an AES-256-GCM ciphertext
// (`value_encrypted`) that is decrypted here, at the point of execution, so a secret like the service
// role key never sits in plaintext in the staged pa_action_approvals payload (mirrors the Supabase
// connector's db_pass_encrypted). `encrypted` controls Vercel-side storage and defaults to true.
const EnvVarSpecSchema = z
  .object({
    key: z.string().min(1).max(256),
    value: z.string().max(65_536).optional(),
    value_encrypted: z.string().max(65_536).optional(),
    encrypted: z.boolean().default(true),
    target: z
      .array(z.enum(["production", "preview", "development"]))
      .min(1)
      .default(["production", "preview", "development"]),
  })
  .refine((v) => typeof v.value === "string" || typeof v.value_encrypted === "string", {
    message: "Each env var needs a value or a value_encrypted.",
  });

export const SetEnvVarsInputSchema = z.object({
  projectId: z.string().min(1).max(100),
  vars: z.array(EnvVarSpecSchema).min(1).max(50),
});
export type SetEnvVarsInput = z.infer<typeof SetEnvVarsInputSchema>;

export const setEnvVarsAction: VercelActionDescriptor<SetEnvVarsInput> = {
  name: "setEnvVars",
  action: "setEnvVars",
  description: "Set several environment variables on a Vercel project in one call (encrypted by default).",
  gate: "gated",
  schema: SetEnvVarsInputSchema,
  async execute(ctx, input) {
    const body: Array<{ key: string; value: string; type: "encrypted" | "plain"; target: string[] }> = [];
    for (const v of input.vars) {
      let value: string;
      if (typeof v.value_encrypted === "string" && v.value_encrypted.length > 0) {
        try {
          value = decrypt(v.value_encrypted);
        } catch {
          return {
            ok: false,
            status: 422,
            error: `Couldn't read the saved value for "${v.key}" — re-stage this env injection.`,
            authError: false,
          };
        }
      } else if (typeof v.value === "string") {
        value = v.value;
      } else {
        return { ok: false, status: 422, error: `Env var "${v.key}" has no value.`, authError: false };
      }
      body.push({
        key: v.key,
        value,
        type: v.encrypted ? "encrypted" : "plain",
        target: v.target,
      });
    }

    const res = await vercelFetch(
      ctx,
      "POST",
      `/v10/projects/${encodeURIComponent(input.projectId)}/env`,
      // The array body is the documented multi-create shape for POST /v10/projects/{id}/env.
      body as unknown as Record<string, unknown>,
    );
    if (!res.ok) return { ok: false, status: res.status, error: res.error, authError: res.authError };

    const keys = input.vars.map((v) => v.key);
    return {
      ok: true,
      summary: `Set ${keys.length} env var(s) on the project: ${keys.join(", ")}.`,
      // Never echo values back — only the key names.
      data: { keys, count: keys.length },
    };
  },
};

// triggerDeploy — POST /v13/deployments { name, project, gitSource? }
export const TriggerDeployInputSchema = z.object({
  projectId: z.string().min(1).max(100),
  // The deployment's display name (Vercel requires one). Defaults to the project id.
  name: z.string().max(100).optional(),
  // Git branch / ref to deploy (git-linked projects). Defaults to "main".
  ref: z.string().max(200).optional(),
  // Deploy to production vs a preview. Defaults to production.
  production: z.boolean().default(true),
});
export type TriggerDeployInput = z.infer<typeof TriggerDeployInputSchema>;

export const triggerDeployAction: VercelActionDescriptor<TriggerDeployInput> = {
  name: "triggerDeploy",
  action: "triggerDeploy",
  description: "Trigger a new deployment of a Vercel project from its connected git ref.",
  gate: "gated",
  schema: TriggerDeployInputSchema,
  async execute(ctx, input) {
    const body: Record<string, unknown> = {
      name: input.name ?? input.projectId,
      project: input.projectId,
      target: input.production ? "production" : "staging",
      gitSource: { type: "github", ref: input.ref ?? "main" },
    };
    const res = await vercelFetch(ctx, "POST", "/v13/deployments", body);
    if (!res.ok) return { ok: false, status: res.status, error: res.error, authError: res.authError };

    const id = str(res.body.id);
    const url = str(res.body.url);
    const state = str(res.body.readyState) ?? str(res.body.status);
    return {
      ok: true,
      summary: `Started deploy of "${input.projectId}"${url ? ` → https://${url}` : ""}.`,
      data: { deploymentId: id, url: url ? `https://${url}` : null, state },
    };
  },
};

// getDeploymentStatus — GET /v13/deployments/{id}  (read-only)
export const GetDeploymentStatusInputSchema = z.object({
  deploymentId: z.string().min(1).max(200),
});
export type GetDeploymentStatusInput = z.infer<typeof GetDeploymentStatusInputSchema>;

export const getDeploymentStatusAction: VercelActionDescriptor<GetDeploymentStatusInput> = {
  name: "getDeploymentStatus",
  action: "getDeploymentStatus",
  description: "Read the current state + URL of a Vercel deployment (read-only).",
  gate: "read",
  schema: GetDeploymentStatusInputSchema,
  async execute(ctx, input) {
    const res = await vercelFetch(
      ctx,
      "GET",
      `/v13/deployments/${encodeURIComponent(input.deploymentId)}`,
    );
    if (!res.ok) return { ok: false, status: res.status, error: res.error, authError: res.authError };

    const state = str(res.body.readyState) ?? str(res.body.status) ?? "UNKNOWN";
    const url = str(res.body.url);
    return {
      ok: true,
      summary: `Deployment is ${state}${url ? ` (https://${url})` : ""}.`,
      data: { state, url: url ? `https://${url}` : null },
    };
  },
};

// attachDomain — POST /v10/projects/{id}/domains { name }  (gated; NEVER auto-approves)
export const AttachDomainInputSchema = z.object({
  projectId: z.string().min(1).max(100),
  domain: z
    .string()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Enter a valid domain like app.example.com."),
});
export type AttachDomainInput = z.infer<typeof AttachDomainInputSchema>;

export const attachDomainAction: VercelActionDescriptor<AttachDomainInput> = {
  name: "attachDomain",
  action: "attachDomain",
  description: "Attach a custom domain to a Vercel project. Single-approval forever (DNS-pointed traffic).",
  gate: "gated",
  schema: AttachDomainInputSchema,
  async execute(ctx, input) {
    const res = await vercelFetch(
      ctx,
      "POST",
      `/v10/projects/${encodeURIComponent(input.projectId)}/domains`,
      { name: input.domain },
    );
    if (!res.ok) return { ok: false, status: res.status, error: res.error, authError: res.authError };

    const verified = res.body.verified === true;
    return {
      ok: true,
      summary: `Attached domain "${input.domain}"${verified ? " (verified)" : " — add the DNS records Vercel shows to finish verification"}.`,
      data: { domain: input.domain, verified },
    };
  },
};

// ── Token check (the connect-time test call) ────────────────────────────────────────────────

export type VercelIdentity = { username: string | null; email: string | null };

/**
 * Validate a freshly pasted token by reading the authenticated user (GET /v2/user). Returns the
 * resolved identity (for the card label) or a typed error. Used by the connect/test routes — NOT
 * an approval-gated action, just a credential probe.
 */
export async function verifyVercelToken(
  token: string,
  teamId: string | null,
): Promise<{ ok: true; identity: VercelIdentity } | { ok: false; status: number; error: string }> {
  const res = await vercelFetch({ token, teamId }, "GET", "/v2/user");
  if (!res.ok) {
    if (res.authError) {
      return { ok: false, status: 401, error: "That token didn't work — Vercel rejected it. Double-check it and try again." };
    }
    return { ok: false, status: res.status, error: res.error };
  }
  const user = res.body.user;
  const identity: VercelIdentity =
    user && typeof user === "object"
      ? { username: str((user as Record<string, unknown>).username), email: str((user as Record<string, unknown>).email) }
      : { username: null, email: null };
  return { ok: true, identity };
}
