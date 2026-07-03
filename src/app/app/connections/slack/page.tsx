// /app/connections/slack — the owner surface for the Slack channel (PA-CHAN-1, SPEC §8.1).
//
// Connect Slack (OAuth) → pick the Persona that answers DMs (PA-CHAN-8) → send a test message →
// disconnect. Tier-gated (PA-CHAN-7): Personal Brain doesn't see the channel at all; Business Agent
// and up can connect. Server component: fetch the connection state, the owner's Personas, the tier,
// and whether Slack OAuth is configured, then hand it to the client card.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchChannelConnectionForOwner } from "@/lib/channels/store";
import { channelSlackOAuthConfigured } from "@/lib/channels/adapters/slack/oauth";
import { listPersonasForBusiness } from "@/lib/personas/db";
import { getPersonaDisplayName } from "@/lib/personas/types";
import { getCurrentTier, tierCanSeeChannels, tierAllowsChannel, TIER_LABELS } from "@/lib/personas/tier-caps";
import SlackChannelClient from "./SlackChannelClient";

export const dynamic = "force-dynamic";

export default async function SlackChannelPage({
  searchParams,
}: {
  searchParams: { slack?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login?next=/app/connections/slack");

  const [connectionResult, personas, tier] = await Promise.all([
    fetchChannelConnectionForOwner(user.id, "slack"),
    listPersonasForBusiness(user.id),
    getCurrentTier(user.id),
  ]);

  const connection = connectionResult.ok ? connectionResult.data : null;
  const personaOptions = personas.map((p) => ({ id: p.id, name: getPersonaDisplayName(p), role: p.template_key }));

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-lg mx-auto px-6 py-10 space-y-7">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-slate-100">Slack</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Text your agent from Slack. DM it or @mention it, and it answers in-place — same agent,
            same memory, same approvals. Anything it drafts gets staged in Mission Control for your
            okay first; nothing goes out without your tap.
          </p>
        </header>

        <SlackChannelClient
          connected={Boolean(connection)}
          enabled={connection?.enabled ?? false}
          workspace={
            typeof connection?.config.workspace === "string" ? connection.config.workspace : null
          }
          currentPersonaId={connection?.personaId ?? null}
          personas={personaOptions}
          tierLabel={TIER_LABELS[tier]}
          tierCanSee={tierCanSeeChannels(tier)}
          tierCanConnect={tierAllowsChannel(tier, "slack")}
          oauthConfigured={channelSlackOAuthConfigured()}
          statusParam={searchParams.slack ?? null}
        />
      </div>
    </div>
  );
}
