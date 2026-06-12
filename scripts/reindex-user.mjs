// One-off full brain re-index for a single owner.
//
// Clears every pocket_agent_memory_index row for the user, runs the deep
// indexer (memory/ + decision logs + SPECs + open questions + change logs),
// regenerates the weekly digest cache, then prints the verified row counts.
//
// Usage (jiti handles the TS imports; the alias resolves "@/"):
//   JITI_ALIAS='{"@":"'$PWD'/src"}' ./node_modules/.bin/jiti scripts/reindex-user.mjs <user_id>
//
// Required env (pull from Vercel: `vercel env pull`):
//   POCKET_AGENT_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
//   POCKET_AGENT_SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
// Optional:
//   ANTHROPIC_API_KEY — digest fallback when the user row has no key

import { indexBrain, fetchMemoryIndex } from "../src/lib/pa-brain-index.ts";
import { generateWeeklyDigest } from "../src/lib/pa-drafts.ts";
import { saveDigestCache } from "../src/lib/pa-supabase.ts";

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: jiti scripts/reindex-user.mjs <user_id>");
  process.exit(1);
}

const url = (process.env.POCKET_AGENT_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) {
  console.error("Missing Supabase env — set POCKET_AGENT_SUPABASE_URL + POCKET_AGENT_SUPABASE_SERVICE_KEY.");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// 1) Resolve the user row.
const userRes = await fetch(
  `${url}/rest/v1/pocket_agent_users?id=eq.${encodeURIComponent(userId)}&select=id,brain_repo,github_token,anthropic_api_key,brain_indexed_at`,
  { headers },
);
if (!userRes.ok) {
  console.error(`User fetch failed (${userRes.status}): ${await userRes.text()}`);
  process.exit(1);
}
const [user] = await userRes.json();
if (!user?.brain_repo) {
  console.error("No user row or no brain_repo connected.");
  process.exit(1);
}
console.log(`User ${user.id} — brain ${user.brain_repo}`);

// 2) Clear the existing index so the new shape starts clean.
const delRes = await fetch(
  `${url}/rest/v1/pocket_agent_memory_index?user_id=eq.${encodeURIComponent(userId)}`,
  { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" } },
);
if (!delRes.ok) {
  console.error(`Index clear failed (${delRes.status}): ${await delRes.text()}`);
  process.exit(1);
}
console.log("Cleared existing index rows.");

// 3) Full deep index.
const result = await indexBrain({ userId, repo: user.brain_repo, token: user.github_token ?? null });
if (!result.ok) {
  console.error(`indexBrain failed: ${result.error}`);
  process.exit(1);
}
console.log(`Indexed ${result.result.indexed} entries (skipped ${result.result.skipped} unchanged files).`);
console.log("By type:", JSON.stringify(result.result.byType));
if (result.result.errors.length > 0) {
  console.warn(`${result.result.errors.length} per-file errors:`);
  for (const e of result.result.errors.slice(0, 10)) console.warn("  -", e);
}

// 4) Regenerate the digest cache (needs an Anthropic key from the row or env).
const anthropicKey = user.anthropic_api_key ?? process.env.ANTHROPIC_API_KEY ?? null;
if (anthropicKey) {
  try {
    const digest = await generateWeeklyDigest(anthropicKey, user.brain_repo, user.github_token ?? null);
    await saveDigestCache(userId, digest);
    console.log("Digest regenerated and cached.");
  } catch (e) {
    console.warn(`Digest generation failed (index still complete): ${e instanceof Error ? e.message : e}`);
  }
} else {
  console.warn("No Anthropic key on the row or in env — digest left for the app to regenerate on next load.");
}

// 5) Verify what actually landed.
const rows = await fetchMemoryIndex(userId);
const byType = {};
for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + 1;
const verifyRes = await fetch(
  `${url}/rest/v1/pocket_agent_users?id=eq.${encodeURIComponent(userId)}&select=brain_indexed_at,brain_digest_generated_at`,
  { headers },
);
const [verify] = verifyRes.ok ? await verifyRes.json() : [{}];

console.log("\n── Verification ──");
console.log(`Total index rows: ${rows.length}`);
console.log("Distribution:", JSON.stringify(byType));
console.log(`brain_indexed_at: ${verify?.brain_indexed_at ?? "(unset)"}`);
console.log(`brain_digest_generated_at: ${verify?.brain_digest_generated_at ?? "(unset)"}`);
