import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchGmailTriageByThread } from "@/lib/pa-inbox-items";
import { redirect } from "next/navigation";
import EmailClient from "../../apps/email/EmailClient";

export const dynamic = "force-dynamic";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// Gmail From header → display name (or bare address).
function senderLabel(from: string): string {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) return match[1].trim() || match[2].trim();
  return from.trim() || "the sender";
}

export default async function CaptureDraftPage({
  searchParams,
}: {
  searchParams: { context?: string; threadId?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  const paUser = paResult.ok ? paResult.data : null;
  if (!paUser) redirect("/app/onboarding");

  // Build a reply brief from the triaged email when we have its thread.
  let initialBrief = "";
  if (searchParams.context === "email_triage" && searchParams.threadId) {
    const found = await fetchGmailTriageByThread(user.id, searchParams.threadId);
    if (found.ok && found.data) {
      const p = found.data.payload;
      const sender = senderLabel(str(p.from));
      const subject = str(p.subject);
      const snippet = str(p.snippet);
      const parts = [
        `Reply to ${sender}${subject ? ` about "${subject}"` : ""}.`,
        snippet ? `Their message: "${snippet}"` : "",
        "Acknowledge, answer their question, and propose a clear next step.",
      ].filter(Boolean);
      initialBrief = parts.join(" ");
    }
  }

  return (
    <EmailClient
      brainRepo={paUser.brain_repo}
      hasApiKey={Boolean(paUser.anthropic_api_key)}
      initial={initialBrief ? { mode: "quick", brief: initialBrief } : undefined}
    />
  );
}
