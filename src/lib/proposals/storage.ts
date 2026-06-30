// storage.ts — stage rendered proposal PDFs in a private Supabase Storage bucket (direct REST, no SDK).
//
// PDFs land at `<bucket>/<owner_id>/<proposal_id>.pdf`. We store the object PATH (bucket/key) in
// pa_proposals.pdf_storage_url; the surface mints a short-lived signed URL on read so a leaked link
// can't expose the file. The bucket is created idempotently on first use.

export const PROPOSAL_BUCKET = process.env.PA_PROPOSALS_BUCKET ?? "proposals"

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
  return { apikey: key, Authorization: `Bearer ${key}` }
}

let bucketEnsured = false

async function ensureBucket(env: { url: string; key: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (bucketEnsured) return { ok: true }
  const res = await fetch(`${env.url}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
    body: JSON.stringify({ id: PROPOSAL_BUCKET, name: PROPOSAL_BUCKET, public: false }),
    cache: "no-store",
  })
  if (res.ok) {
    bucketEnsured = true
    return { ok: true }
  }
  const body = await res.text()
  if (res.status === 409 || /already exists|Duplicate/i.test(body)) {
    bucketEnsured = true
    return { ok: true }
  }
  return { ok: false, error: `bucket ensure failed (${res.status}): ${body}` }
}

export type UploadResult = { ok: true; path: string } | { ok: false; error: string }

/** Upload a proposal PDF and return its `<bucket>/<owner>/<id>.pdf` object path. Upserts on retry. */
export async function uploadProposalPdf(params: {
  ownerId: string
  proposalId: string
  bytes: Buffer
}): Promise<UploadResult> {
  const env = paEnv()
  if ("error" in env) return { ok: false, error: env.error }
  const ensured = await ensureBucket(env)
  if (!ensured.ok) return ensured

  const objectPath = `${params.ownerId}/${params.proposalId}.pdf`
  const res = await fetch(`${env.url}/storage/v1/object/${PROPOSAL_BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/pdf", "x-upsert": "true" },
    body: new Uint8Array(params.bytes),
    cache: "no-store",
  })
  if (!res.ok) return { ok: false, error: `pdf upload failed (${res.status}): ${await res.text()}` }
  return { ok: true, path: `${PROPOSAL_BUCKET}/${objectPath}` }
}

export type SignResult = { ok: true; url: string } | { ok: false; error: string }

const SIGN_EXPIRES_SECONDS = 60 * 60 // 1 hour — long enough to open + download from the surface.

/** Mint a short-lived signed URL for a stored proposal PDF path (`bucket/key`). */
export async function signProposalPdf(storagePath: string): Promise<SignResult> {
  const env = paEnv()
  if ("error" in env) return { ok: false, error: env.error }
  const slash = storagePath.indexOf("/")
  if (slash <= 0) return { ok: false, error: "malformed storage path" }
  const bucket = storagePath.slice(0, slash)
  const key = storagePath.slice(slash + 1)

  const res = await fetch(`${env.url}/storage/v1/object/sign/${bucket}/${key}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: SIGN_EXPIRES_SECONDS }),
    cache: "no-store",
  })
  if (!res.ok) return { ok: false, error: `sign failed (${res.status}): ${await res.text()}` }
  const data = (await res.json()) as { signedURL?: string }
  if (!data.signedURL) return { ok: false, error: "Storage response missing signedURL" }
  const absolute = data.signedURL.startsWith("http") ? data.signedURL : `${env.url}/storage/v1${data.signedURL}`
  return { ok: true, url: absolute }
}
