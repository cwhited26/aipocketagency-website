// lib/channels/outbound.ts — the outbound dispatcher. Given a resolved connection + a
// channel-agnostic ChannelResponse, it picks the adapter for the connection's channel and sends.
// One seam so the gateway never names a specific channel on the way out, and a send failure is
// reported as a typed result (auth failures flip the connection to an error state upstream) rather
// than thrown across the gateway boundary.

import { getAdapter } from "./registry";
import { ChannelSendError, type ChannelConnection, type ChannelResponse } from "./types";
import { channelLog } from "./log";

export type OutboundResult = { ok: true } | { ok: false; authError: boolean; error: string };

export async function dispatchOutbound(
  connection: ChannelConnection,
  response: ChannelResponse,
): Promise<OutboundResult> {
  const adapter = getAdapter(connection.channelSlug);
  if (!adapter) {
    channelLog.error("no adapter for channel", { channelSlug: connection.channelSlug });
    return { ok: false, authError: false, error: "no_adapter" };
  }

  try {
    await adapter.sendOutbound(connection, response);
    return { ok: true };
  } catch (err) {
    if (err instanceof ChannelSendError) {
      return { ok: false, authError: err.authError, error: err.message };
    }
    channelLog.error("outbound send threw", {
      channelSlug: connection.channelSlug,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, authError: false, error: "send_failed" };
  }
}
