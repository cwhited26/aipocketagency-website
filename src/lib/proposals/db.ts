// db.ts — PostgREST data access for pa_proposals (direct REST, no SDK). Service-role key; every
// owner-scoped read/write gates on owner_id in the query string. Typed results, never throws.

import type { ProposalBrief, ProposalStatus, ProposalView } from "./types"

export type ProposalResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY
  if (!url || !key) return { error: "Supabase service-role env vars not set" }
  return { url: url.replace(/\/$/, ""), key }
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" }
}

type ProposalRow = {
  id: string
  owner_id: string
  persona_id: string | null
  client_name: string
  brief: ProposalBrief
  generated_markdown: string
  pdf_storage_url: string | null
  status: ProposalStatus
  created_at: string
  sent_at: string | null
}

function rowToView(r: ProposalRow): ProposalView {
  return {
    id: r.id,
    personaId: r.persona_id,
    clientName: r.client_name,
    brief: r.brief,
    generatedMarkdown: r.generated_markdown,
    pdfStorageUrl: r.pdf_storage_url,
    status: r.status,
    createdAt: r.created_at,
    sentAt: r.sent_at,
  }
}

export async function listProposals(ownerId: string): Promise<ProposalResult<ProposalView[]>> {
  const env = paEnv()
  if ("error" in env) return { ok: false, status: 500, error: env.error }
  const res = await fetch(
    `${env.url}/rest/v1/pa_proposals?owner_id=eq.${encodeURIComponent(ownerId)}&order=created_at.desc`,
    { headers: authHeaders(env.key), cache: "no-store" },
  )
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() }
  return { ok: true, data: ((await res.json()) as ProposalRow[]).map(rowToView) }
}

export async function getProposal(ownerId: string, id: string): Promise<ProposalResult<ProposalView | null>> {
  const env = paEnv()
  if ("error" in env) return { ok: false, status: 500, error: env.error }
  const res = await fetch(
    `${env.url}/rest/v1/pa_proposals?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    { headers: authHeaders(env.key), cache: "no-store" },
  )
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() }
  const rows = (await res.json()) as ProposalRow[]
  return { ok: true, data: rows.length ? rowToView(rows[0]) : null }
}

export async function createProposal(params: {
  ownerId: string
  personaId: string | null
  clientName: string
  brief: ProposalBrief
  generatedMarkdown: string
}): Promise<ProposalResult<ProposalView>> {
  const env = paEnv()
  if ("error" in env) return { ok: false, status: 500, error: env.error }
  const res = await fetch(`${env.url}/rest/v1/pa_proposals`, {
    method: "POST",
    headers: { ...authHeaders(env.key), Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: params.ownerId,
      persona_id: params.personaId,
      client_name: params.clientName,
      brief: params.brief,
      generated_markdown: params.generatedMarkdown,
      status: "draft",
    }),
  })
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() }
  return { ok: true, data: rowToView(((await res.json()) as ProposalRow[])[0]) }
}

/** Patch the editable markdown and/or status (and pdf/sent stamps on send). */
export async function updateProposal(
  ownerId: string,
  id: string,
  patch: {
    generatedMarkdown?: string
    status?: ProposalStatus
    pdfStorageUrl?: string | null
    sentAt?: string | null
  },
): Promise<ProposalResult<ProposalView | null>> {
  const env = paEnv()
  if ("error" in env) return { ok: false, status: 500, error: env.error }
  const body: Record<string, unknown> = {}
  if (patch.generatedMarkdown !== undefined) body.generated_markdown = patch.generatedMarkdown
  if (patch.status !== undefined) body.status = patch.status
  if (patch.pdfStorageUrl !== undefined) body.pdf_storage_url = patch.pdfStorageUrl
  if (patch.sentAt !== undefined) body.sent_at = patch.sentAt
  if (Object.keys(body).length === 0) return getProposal(ownerId, id)

  const res = await fetch(
    `${env.url}/rest/v1/pa_proposals?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    { method: "PATCH", headers: { ...authHeaders(env.key), Prefer: "return=representation" }, body: JSON.stringify(body) },
  )
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() }
  const rows = (await res.json()) as ProposalRow[]
  return { ok: true, data: rows.length ? rowToView(rows[0]) : null }
}

export async function deleteProposal(ownerId: string, id: string): Promise<ProposalResult<true>> {
  const env = paEnv()
  if ("error" in env) return { ok: false, status: 500, error: env.error }
  const res = await fetch(
    `${env.url}/rest/v1/pa_proposals?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    { method: "DELETE", headers: authHeaders(env.key) },
  )
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() }
  return { ok: true, data: true }
}
