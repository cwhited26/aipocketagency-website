type ApaLeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  source: string;
  status: "new";
};

type InsertResult = { ok: true } | { ok: false; status: number; error: string };

export async function insertApaLead(row: ApaLeadRow): Promise<InsertResult> {
  const url = process.env.WC_ADMIN_SUPABASE_URL;
  const key = process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    return {
      ok: false,
      status: 500,
      error: "WC_ADMIN_SUPABASE_URL / WC_ADMIN_SUPABASE_SERVICE_KEY not set",
    };
  }

  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/apa_leads`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}
