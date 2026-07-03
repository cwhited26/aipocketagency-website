// Tests for the WhatsApp adapter (Channels Gateway Phase 4, PA-CHAN-1/4/5/9/12) — no network
// (fetch mocked). Covers the X-Hub-Signature-256 gate, the Meta envelope classification (text +
// native Approve/Edit/Reject button taps), staging an untrusted ChannelMessage, and the outbound
// send: the Graph API call (interactive buttons for a staged reply, text otherwise) plus the
// pa_channel_messages outbound row recorded through the gateway.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWhatsappMessage,
  buildWhatsappSendPayload,
  classifyWhatsappPayload,
  normalizeWhatsappNumber,
  whatsappExternalId,
} from "../adapter";
import { computeHubSignature, verifyHubSignature } from "../signing";
import { routeChannelMessage, type GatewayDeps } from "@/lib/channels/gateway";
import { dispatchOutbound } from "@/lib/channels/outbound";
import type { ChannelConnection } from "@/lib/channels/types";
import type { PaUser } from "@/lib/pa-supabase";

const APP_SECRET = "meta-app-secret-1234";
const PHONE_NUMBER_ID = "123456789012345";

function metaPayload(message: Record<string, unknown>): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15559990002", phone_number_id: PHONE_NUMBER_ID },
              contacts: [{ profile: { name: "Chase" }, wa_id: "15551230001" }],
              messages: [message],
            },
          },
        ],
      },
    ],
  });
}

function textPayload(body: string): string {
  return metaPayload({ from: "15551230001", id: "wamid.1", type: "text", text: { body } });
}

function makeConnection(over: Partial<ChannelConnection> = {}): ChannelConnection {
  return {
    id: "conn-wa",
    ownerId: "owner-1",
    channelSlug: "whatsapp",
    externalId: whatsappExternalId(PHONE_NUMBER_ID),
    personaId: null,
    authToken: "wa-access-token",
    config: { phoneNumberId: PHONE_NUMBER_ID, ownerNumber: "15551230001" },
    enabled: true,
    ...over,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("whatsapp inbound: signature + staging", () => {
  it("verifies a genuine X-Hub-Signature-256 and rejects a tampered body", () => {
    const rawBody = textPayload("hello");
    const signature = computeHubSignature(APP_SECRET, rawBody);
    expect(signature.startsWith("sha256=")).toBe(true);
    expect(verifyHubSignature({ appSecret: APP_SECRET, rawBody, signature })).toBe(true);
    expect(
      verifyHubSignature({ appSecret: APP_SECRET, rawBody: rawBody + " ", signature }),
    ).toBe(false);
    expect(verifyHubSignature({ appSecret: APP_SECRET, rawBody, signature: null })).toBe(false);
  });

  it("classifies a text delivery and stages an untrusted ChannelMessage keyed by the number id", () => {
    const inbound = classifyWhatsappPayload(textPayload("what's my pipeline look like?"));
    expect(inbound.kind).toBe("message");
    if (inbound.kind !== "message") throw new Error("expected message");
    expect(inbound.buttonCommand).toBeNull();
    const message = buildWhatsappMessage({ ...inbound, rawPayload: {} });
    expect(message.channelSlug).toBe("whatsapp");
    expect(message.externalId).toBe(`wa:${PHONE_NUMBER_ID}`);
    expect(message.untrustedOrigin).toBe(true);
    expect(message.providerMessageId).toBe("wamid.1");
    expect(message.channelMeta).toMatchObject({ from: "15551230001" });
  });

  it("classifies a native button tap into a protocol command", () => {
    const inbound = classifyWhatsappPayload(
      metaPayload({
        from: "15551230001",
        id: "wamid.2",
        type: "interactive",
        interactive: { type: "button_reply", button_reply: { id: "approve", title: "Approve & send" } },
      }),
    );
    expect(inbound.kind).toBe("message");
    if (inbound.kind !== "message") throw new Error("expected message");
    expect(inbound.buttonCommand).toBe("approve");
  });

  it("ignores status-only deliveries", () => {
    const statuses = JSON.stringify({
      entry: [
        {
          changes: [
            { value: { metadata: { phone_number_id: PHONE_NUMBER_ID }, statuses: [{ id: "x" }] } },
          ],
        },
      ],
    });
    expect(classifyWhatsappPayload(statuses)).toEqual({ kind: "ignore", reason: "no_message" });
  });

  it("normalizes pasted numbers to WhatsApp's bare-digit shape", () => {
    expect(normalizeWhatsappNumber("+1 (555) 123-0001")).toBe("15551230001");
  });
});

describe("whatsapp outbound: send + forensics log", () => {
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

  it("renders native Approve / Edit / Reject buttons for a staged reply and text otherwise", () => {
    const staged = buildWhatsappSendPayload("15551230001", {
      text: "[Draft] Reply to Jenny: 'Sounds good, see you at 2.'",
      staged: true,
      threadId: null,
      channelMeta: {},
    });
    expect(staged.type).toBe("interactive");
    const interactive = staged.interactive as {
      action: { buttons: { reply: { id: string; title: string } }[] };
    };
    expect(interactive.action.buttons.map((b) => b.reply.id)).toEqual(["approve", "edit", "reject"]);

    const plain = buildWhatsappSendPayload("15551230001", {
      text: "All caught up.",
      threadId: null,
      channelMeta: {},
    });
    expect(plain.type).toBe("text");

    // Over the 1024-char interactive cap → falls back to the text protocol.
    const long = buildWhatsappSendPayload("15551230001", {
      text: "x".repeat(1100),
      staged: true,
      threadId: null,
      channelMeta: {},
    });
    expect(long.type).toBe("text");
    expect((long.text as { body: string }).body).toContain("Reply APPROVE");
  });

  it("POSTs to the Graph messages endpoint and records the outbound pa_channel_messages row", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const recorded: { direction: string; body: string }[] = [];
    const deps: GatewayDeps = {
      resolveConnection: vi.fn(async () => makeConnection()),
      getTier: vi.fn(async () => "pro" as const),
      loadPaUser: vi.fn(async () => PA_USER),
      resolveRunZone: vi.fn(async () => "project-shared"),
      ensureConversationId: vi.fn(async () => "conv-1"),
      dispatchGoal: vi.fn(async () => ({ kind: "simple" as const, reason: "quick lookup" })),
      chatTurn: vi.fn(async () => ({
        ok: true as const,
        finalAnswer: "Three deals waiting on you.",
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

    const inbound = classifyWhatsappPayload(textPayload("what's my pipeline look like?"));
    if (inbound.kind !== "message") throw new Error("expected message");
    const outcome = await routeChannelMessage(
      buildWhatsappMessage({ ...inbound, rawPayload: {} }),
      deps,
    );

    expect(outcome).toEqual({ handled: "replied", ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer wa-access-token");
    expect(JSON.parse(String(init.body))).toEqual({
      messaging_product: "whatsapp",
      to: "15551230001",
      type: "text",
      text: { body: "Three deals waiting on you." },
    });
    expect(recorded).toEqual([
      { direction: "inbound", body: "what's my pipeline look like?" },
      { direction: "outbound", body: "Three deals waiting on you." },
    ]);
  });

  it("flags a dead access token as an auth error (reconnect state)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const result = await dispatchOutbound(makeConnection(), {
      text: "hi",
      threadId: null,
      channelMeta: { from: "15551230001", surface: "im" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.authError).toBe(true);
  });
});
