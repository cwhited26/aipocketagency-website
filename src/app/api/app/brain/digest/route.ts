import { createClient } from "@/lib/supabase/server";
import { fetchPaUser, fetchCachedDigest, saveDigestCache } from "@/lib/pa-supabase";
import { generateWeeklyDigest } from "@/lib/pa-drafts";
import type { DigestPayload } from "@/lib/pa-drafts";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ─── GET — return cached digest (generate if stale) ───────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { anthropic_api_key, brain_repo, github_token } = paResult.data;

  if (!anthropic_api_key) {
    return NextResponse.json({ error: "No Anthropic API key" }, { status: 422 });
  }

  // Check cache
  const cached = await fetchCachedDigest(user.id);
  if (
    cached?.brain_digest_json &&
    cached.brain_digest_generated_at &&
    Date.now() - new Date(cached.brain_digest_generated_at).getTime() < CACHE_TTL_MS
  ) {
    return NextResponse.json({ digest: cached.brain_digest_json, cached: true });
  }

  // Generate fresh
  const digest = await generateWeeklyDigest(anthropic_api_key, brain_repo, github_token);
  await saveDigestCache(user.id, digest as unknown as Record<string, unknown>);
  return NextResponse.json({ digest, cached: false });
}

// ─── POST — force-refresh the digest ─────────────────────────────────────────

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { anthropic_api_key, brain_repo, github_token } = paResult.data;

  if (!anthropic_api_key) {
    return NextResponse.json({ error: "No Anthropic API key" }, { status: 422 });
  }

  const digest: DigestPayload = await generateWeeklyDigest(
    anthropic_api_key,
    brain_repo,
    github_token,
  );
  await saveDigestCache(user.id, digest as unknown as Record<string, unknown>);
  return NextResponse.json({ digest, cached: false });
}
