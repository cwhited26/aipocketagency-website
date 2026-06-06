// /public-persona/<token> — the anonymous chat surface for Mode B (public link) and the
// iframe target for Mode C (widget, ?embed=1). Behind PA_PERSONAS_PUBLIC_MODES_ENABLED.
// Minimal chat UI, no PA nav. A per-token frame-ancestors CSP is set by middleware.ts.

import { fetchPersona, fetchShareToken, fetchWidgetConfig } from "@/lib/personas/db";
import { isTokenLive } from "@/lib/personas/tokens";
import { isPublicMode } from "@/lib/personas/types";
import { publicModesEnabled } from "@/lib/personas/feature-flags";
import PublicPersonaClient from "./PublicPersonaClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat", robots: { index: false, follow: false } };

export default async function PublicPersonaPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { embed?: string };
}) {
  const embed = searchParams.embed === "1";

  if (!publicModesEnabled()) {
    return (
      <Centered
        embed={embed}
        title="Launching soon"
        body="This assistant goes live after our final testing. Check back shortly."
      />
    );
  }

  let personaId = "";
  let personaName = "";
  let badgeRemoved = false;
  let leadCaptureEnabled = true;
  let leadCaptureTiming: "pre_chat" | "mid_conversation" | "post_conversation" | "off" = "pre_chat";
  let greeting = "Hi! How can I help you today?";
  let invalid = false;
  let paused = false;

  try {
    const tokenRow = await fetchShareToken(params.token);
    if (!tokenRow || !isTokenLive(tokenRow) || !isPublicMode(tokenRow.mode)) {
      invalid = true;
    } else {
      const persona = await fetchPersona(tokenRow.persona_id);
      if (!persona || persona.status === "archived") {
        invalid = true;
      } else if (persona.status !== "active") {
        paused = true;
        personaName = persona.name;
      } else {
        personaId = persona.id;
        personaName = persona.name;
        const config = await fetchWidgetConfig(persona.id);
        if (config) {
          badgeRemoved = config.badge_removed;
          leadCaptureEnabled = config.lead_capture_enabled;
          leadCaptureTiming = config.lead_capture_timing;
          greeting = config.greeting_text || greeting;
        }
      }
    }
  } catch {
    invalid = true;
  }

  if (invalid) {
    return <Centered embed={embed} title="This link isn't valid" body="Please ask for a new one." />;
  }
  if (paused) {
    return <Centered embed={embed} title={`${personaName} is unavailable`} body="Please check back later." />;
  }

  return (
    <PublicPersonaClient
      personaId={personaId}
      personaName={personaName}
      token={params.token}
      greeting={greeting}
      badgeRemoved={badgeRemoved}
      leadCaptureEnabled={leadCaptureEnabled && leadCaptureTiming === "pre_chat"}
      embed={embed}
    />
  );
}

function Centered({ embed, title, body }: { embed: boolean; title: string; body: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-[#05070a] text-slate-100 px-6 ${
        embed ? "h-screen" : "min-h-screen"
      }`}
    >
      <div className="text-center max-w-sm">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-slate-500 mt-2">{body}</p>
        <p className="text-[11px] text-slate-600 mt-6">Built with Pocket Agent.</p>
      </div>
    </div>
  );
}
