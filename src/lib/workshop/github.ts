// lib/workshop/github.ts — the attendee-side GitHub flow for the workshop's "build with me"
// buttons (PA-POS-38 §24.4): fork the template repo (POST /generate) and write zone files into
// the fork (Contents API PUT). Direct REST, no Octokit — standing rule.
//
// OAuth rides the SHIPPED GitHub Build OAuth App (GITHUB_BUILD_OAUTH_CLIENT_ID/SECRET). The
// workshop redirect URI is a SUBPATH of the registered callback
// (/api/connectors/github-build/callback/workshop) — GitHub permits subdirectory redirect_uris,
// so no second OAuth App. Scope is `repo` only: the attendee grants fork + contents writes,
// nothing more (no workflow, no delete_repo — the Build connector's wider grant is not needed
// mid-workshop). State is the AES-256-GCM envelope of the registration id, so the callback
// authenticates the round-trip without a session.

import { z } from "zod";
import { encrypt, decrypt } from "@/lib/crypto/encrypt";
import { githubBuildConfig, type GithubBuildConfig } from "@/lib/connectors/github-build/oauth";

const GITHUB_API = "https://api.github.com";
const GITHUB_OAUTH_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_OAUTH_TOKEN = "https://github.com/login/oauth/access_token";

export const DEFAULT_TEMPLATE_REPO = "cwhited26/pocket-agent-brain-template";

export function workshopTemplateRepo(): string {
  return process.env.PA_WORKSHOP_TEMPLATE_REPO ?? DEFAULT_TEMPLATE_REPO;
}

export type GhResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "PocketAgent",
    "Content-Type": "application/json",
  };
}

// ── OAuth (workshop variant) ─────────────────────────────────────────────────────────────────────

const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

export function workshopGithubRedirectUri(): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(/\/+$/, "");
  return `${base}/api/connectors/github-build/callback/workshop`;
}

export function isWorkshopGithubConfigured(): boolean {
  return githubBuildConfig() !== null;
}

/** The authorize URL the fork button opens when the attendee hasn't granted GitHub yet. */
export function workshopGithubAuthorizeUrl(registrationId: string): string | null {
  const config = githubBuildConfig();
  if (!config) return null;
  const url = new URL(GITHUB_OAUTH_AUTHORIZE);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", workshopGithubRedirectUri());
  url.searchParams.set("scope", "repo");
  url.searchParams.set("state", encodeWorkshopOauthState(registrationId));
  return url.toString();
}

/** State = authenticated envelope of the registration id (AES-256-GCM; tamper → decrypt throws). */
export function encodeWorkshopOauthState(registrationId: string): string {
  return encrypt(`workshop:${registrationId}`);
}

export function decodeWorkshopOauthState(state: string): string | null {
  try {
    const plain = decrypt(state);
    if (!plain.startsWith("workshop:")) return null;
    return plain.slice("workshop:".length);
  } catch {
    return null;
  }
}

const TokenResponseSchema = z.object({ access_token: z.string().min(1) });
const TokenErrorSchema = z.object({ error: z.string(), error_description: z.string().optional() });

export async function exchangeWorkshopGithubCode(
  code: string,
  config: GithubBuildConfig,
): Promise<GhResult<string>> {
  const res = await fetch(GITHUB_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: workshopGithubRedirectUri(),
    }).toString(),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 400) };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, status: 502, error: "token endpoint returned non-JSON" };
  }
  const err = TokenErrorSchema.safeParse(raw);
  if (err.success) {
    return { ok: false, status: 400, error: err.data.error_description ?? err.data.error };
  }
  const parsed = TokenResponseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 502, error: "token response shape invalid" };
  return { ok: true, data: parsed.data.access_token };
}

const GithubUserSchema = z.object({ login: z.string().min(1) });

export async function fetchWorkshopGithubLogin(token: string): Promise<GhResult<string>> {
  const res = await fetch(`${GITHUB_API}/user`, { headers: ghHeaders(token), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const parsed = GithubUserSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return { ok: false, status: 502, error: "user response shape invalid" };
  return { ok: true, data: parsed.data.login };
}

// ── Fork (template generate) ─────────────────────────────────────────────────────────────────────

const GeneratedRepoSchema = z.object({
  full_name: z.string().min(1),
  html_url: z.string().min(1),
});
export type GeneratedRepo = z.infer<typeof GeneratedRepoSchema>;

/**
 * Create the attendee's Business Brain from the template repo:
 * POST /repos/{template}/generate with the attendee's token — the new repo lands under THEIR
 * account as `business-brain` (§24.4 min-15 button). 422 with "already exists" is treated as
 * success-by-lookup so a double click never errors.
 */
export async function generateBusinessBrainRepo(
  token: string,
  login: string,
): Promise<GhResult<GeneratedRepo>> {
  const template = workshopTemplateRepo();
  const res = await fetch(`${GITHUB_API}/repos/${template}/generate`, {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({
      name: "business-brain",
      description: "My Business Brain — built at the Business Brain Workshop",
      private: true,
    }),
    cache: "no-store",
  });
  if (res.status === 422) {
    // Name already taken under their account — the repo exists (double click / re-run). Fetch it.
    const existing = await fetch(`${GITHUB_API}/repos/${login}/business-brain`, {
      headers: ghHeaders(token),
      cache: "no-store",
    });
    if (existing.ok) {
      const parsed = GeneratedRepoSchema.safeParse(await existing.json().catch(() => null));
      if (parsed.success) return { ok: true, data: parsed.data };
    }
    return { ok: false, status: 422, error: "repo name taken and lookup failed" };
  }
  if (!res.ok) return { ok: false, status: res.status, error: (await res.text()).slice(0, 400) };
  const parsed = GeneratedRepoSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return { ok: false, status: 502, error: "generate response shape invalid" };
  return { ok: true, data: parsed.data };
}

// ── Zone writes (Contents API) ───────────────────────────────────────────────────────────────────

const ContentsShaSchema = z.object({ sha: z.string().min(1) });

/**
 * Write a zone file into the attendee's fork: PUT /repos/{fork}/contents/{zone}.md. Reads the
 * current file sha first so the write updates in place when the template already ships the file.
 */
export async function putZoneFile(args: {
  token: string;
  repoFullName: string;
  zone: string;
  content: string;
}): Promise<GhResult<{ path: string }>> {
  const path = `${args.zone}.md`;
  const contentsUrl = `${GITHUB_API}/repos/${args.repoFullName}/contents/${path}`;

  let sha: string | undefined;
  const head = await fetch(contentsUrl, { headers: ghHeaders(args.token), cache: "no-store" });
  if (head.ok) {
    const parsed = ContentsShaSchema.safeParse(await head.json().catch(() => null));
    if (parsed.success) sha = parsed.data.sha;
  }

  const res = await fetch(contentsUrl, {
    method: "PUT",
    headers: ghHeaders(args.token),
    body: JSON.stringify({
      message: `Add ${args.zone} zone — Business Brain Workshop`,
      content: Buffer.from(args.content, "utf8").toString("base64"),
      ...(sha ? { sha } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: (await res.text()).slice(0, 400) };
  return { ok: true, data: { path } };
}
