// Tests for the iMessage adapter (Channels Gateway Phase 3, PA-CHAN-1/4/5/9) — no network (fetch
// mocked). Covers the X-BB-Signature gate, payload classification (new-message routes; isFromMe /
// non-message events are ignored so the bridge can't loop), staging an untrusted ChannelMessage,
// and the outbound send: the BlueBubbles REST call plus the pa_channel_messages outbound row
// recorded through the gateway.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildImessageMessage,
  classifyBlueBubblesPayload,
  imessageAdapter,
  imessageExternalId,
  normalizeImessageHandle,
  renderImessageText,
} from "../adapter";
import { computeBlueBubblesSignature, verifyBlueBubblesSignature } from "../signing";
import { STAGED_PROTOCOL_FOOTER } from "@/lib/channels/staged-actions";
import { routeChannelMessage, type GatewayDeps } from "@/lib/channels/gateway";
import { dispatchOutbound } from "@/lib/channels/outbound";
import type { ChannelConnection } from "@/lib/channels/types";
import type { PaUser } from "@/lib/pa-supabase";

const SECRET = "bluebubbles-webhook-secret-1234";

function bbPayload(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "new-message",
    data: {
      guid: "msg-guid-1",
      text: "what's on my calendar tomorrow?",
      isFromMe: false,
      chats: [{ guid: "iMessage;-;+15551230001" }],
      handle: { address: "+1 (555) 123-0001" },
      ...over,
    },
  });
}

function makeConnection(over: Partial<ChannelConnection> = {}): ChannelConnection {
  return {
    id: "conn-imsg",
    ownerId: "owner-1",
    channelSlug: "imessage",
    externalId: imessageExternalId("+15551230001"),
    personaId: null,
    authToken: "bb-password",
    config: { serverUrl: "https://mac.example.com:1234", ownerHandle: "+15551230001" },
    enabled: true,
    ...over,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("imessage inbound: signature + staging", () => {
  it("verifies a genuine X-BB-Signature and rejects a tampered body", () => {
    const rawBody = bbPayload();
    const signature = computeBlueBubblesSignature(SECRET, rawBody);
    expect(verifyBlueBubblesSignature({ secret: SECRET, rawBody, signature })).toBe(true);
    expect(
      verifyBlueBubblesSignature({ secret: SECRET, rawBody: rawBody + " ", signature }),
    ).toBe(false);
    expect(verifyBlueBubblesSignature({ secret: SECRET, rawBody, signature: null })).toBe(false);
  });

  it("classifies a new-message into a routable inbound and stages it untrusted", () => {
    const inbound = classifyBlueBubblesPayload(bbPayload());
    expect(inbound.kind).toBe("message");
    if (inbound.kind !== "message") throw new Error("expected message");
    const message = buildImessageMessage({ ...inbound, rawPayload: {} });
    expect(message.channelSlug).toBe("imessage");
    // The handle normalizes: "+1 (555) 123-0001" resolves the same pairing as "+15551230001".
    expect(message.externalId).toBe("imsg:+15551230001");
    expect(message.untrustedOrigin).toBe(true);
    expect(message.threadId).toBe("iMessage;-;+15551230001");
    expect(message.providerMessageId).toBe("msg-guid-1");
  });

  it("ignores our own outgoing messages (isFromMe) so the bridge can't loop", () => {
    expect(classifyBlueBubblesPayload(bbPayload({ isFromMe: true }))).toEqual({
      kind: "ignore",
      reason: "from_me",
    });
  });

  it("ignores non-message webhook events and unparseable payloads", () => {
    expect(
      classifyBlueBubblesPayload(JSON.stringify({ type: "typing-indicator", data: { guid: "x" } })),
    ).toEqual({ kind: "ignore", reason: "type:typing-indicator" });
    expect(classifyBlueBubblesPayload("not json")).toEqual({ kind: "ignore", reason: "not_json" });
  });

  it("normalizes email handles to lowercase", () => {
    expect(normalizeImessageHandle(" Chase@iCloud.com ")).toBe("chase@icloud.com");
  });
});

describe("imessage outbound: send + forensics log", () => {
  const PA_USER: PaUser = {
    id: "owner-1",
    github_username: "owner",
    brain_repo: "owner/brain",
    github_token: "ght",
    anthropic_api_key: "sk-ant",
    brain_root_index_json: null,
    brain_indexed_at: null,
    setup_bar_dismissed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("appends the protocol footer to a staged reply", () => {
    expect(
      renderImessageText({ text: "Drafted it.", staged: true, threadId: null, channelMeta: {} }),
    ).toBe(`Drafted it.\n\n${STAGED_PROTOCOL_FOOTER}`);
  });

  it("POSTs to the BlueBubbles text endpoint and records the outbound pa_channel_messages row", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const recorded: { direction: string; body: string }[] = [];
    const deps: GatewayDeps = {
      resolveConnection: vi.fn(async () => makeConnection()),
      getTier: vi.fn(async () => "studio_plus" as const),
      loadPaUser: vi.fn(async () => PA_USER),
      resolveRunZone: vi.fn(async () => "project-shared"),
      ensureConversationId: vi.fn(async () => "conv-1"),
      dispatchGoal: vi.fn(async () => ({ kind: "simple" as const, reason: "quick lookup" })),
      chatTurn: vi.fn(async () => ({
        ok: true as const,
        finalAnswer: "Two calls before noon.",
        toolSteps: [],
      })),
      recordMessage: vi.fn(async (p: { direction: "inbound" | "outbound"; body: string }) => {
        recorded.push({ direction: p.direction, body: p.body });
        return "msg-1";
      }),
      send: (connection, response) => dispatchOutbound(connection, response),
      flagConnectionError: vi.fn(async () => {}),
      missionControlUrl: () => "https://aipocketagent.com/app/mission-control",
    };

    const inbound = classifyBlueBubblesPayload(bbPayload());
    if (inbound.kind !== "message") throw new Error("expected message");
    const outcome = await routeChannelMessage(
      buildImessageMessage({ ...inbound, rawPayload: {} }),
      deps,
    );

    expect(outcome).toEqual({ handled: "replied", ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://mac.example.com:1234/api/v1/message/text?password=bb-password",
    );
    expect(JSON.parse(String(init.body))).toEqual({
      chatGuid: "iMessage;-;+15551230001",
      message: "Two calls before noon.",
    });
    expect(recorded).toEqual([
      { direction: "inbound", body: "what's on my calendar tomorrow?" },
      { direction: "outbound", body: "Two calls before noon." },
    ]);
  });

  it("flags a wrong server password as an auth error (reconnect state)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unauthorized", { status: 401 })));
    const result = await dispatchOutbound(makeConnection(), {
      text: "hi",
      threadId: null,
      channelMeta: { chatGuid: "iMessage;-;+15551230001", surface: "im" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.authError).toBe(true);
  });

  it("treats an unreachable Mac as transient, not an auth failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const result = await imessageAdapter
      .sendOutbound(makeConnection(), {
        text: "hi",
        threadId: null,
        channelMeta: { chatGuid: "g", surface: "im" },
      })
      .then(() => null)
      .catch((e: unknown) => e as { authError: boolean });
    expect(result?.authError).toBe(false);
  });
});
