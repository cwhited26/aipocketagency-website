// Tests for the SMS adapter (Channels Gateway Phase 2, PA-CHAN-1/4/5/9) — no network (fetch
// mocked). Covers the Twilio signature gate, form parse → untrusted ChannelMessage, MMS media
// extraction, the APPROVE/EDIT/REJECT protocol matcher, and the outbound send: the Twilio Messages
// REST call plus the pa_channel_messages outbound row recorded through the gateway.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSmsMessage,
  parseSmsForm,
  readSmsMedia,
  renderSmsText,
  smsAdapter,
  smsExternalId,
  SmsWebhookSchema,
} from "../adapter";
import { computeTwilioSignature, verifyTwilioSignature } from "@/lib/connectors/sms/signature";
import { matchProtocolCommand, STAGED_PROTOCOL_FOOTER } from "@/lib/channels/staged-actions";
import { routeChannelMessage, type GatewayDeps } from "@/lib/channels/gateway";
import { dispatchOutbound } from "@/lib/channels/outbound";
import type { ChannelConnection } from "@/lib/channels/types";
import type { PaUser } from "@/lib/pa-supabase";

const WEBHOOK_URL = "https://aipocketagent.com/api/channels/inbound/sms";
const AUTH_TOKEN = "twilio-auth-token-1234";

function twilioParams(over: Record<string, string> = {}): Record<string, string> {
  return {
    From: "+15551230001",
    To: "+15559990002",
    Body: "draft a follow-up to Jenny",
    MessageSid: "SM123",
    NumMedia: "0",
    ...over,
  };
}

function makeConnection(over: Partial<ChannelConnection> = {}): ChannelConnection {
  return {
    id: "conn-sms",
    ownerId: "owner-1",
    channelSlug: "sms",
    externalId: smsExternalId("+15551230001"),
    personaId: null,
    authToken: AUTH_TOKEN,
    config: { accountSid: "AC" + "a".repeat(32), ownerPhone: "+15551230001", fromNumber: "+15559990002" },
    enabled: true,
    ...over,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sms inbound: signature + staging", () => {
  it("verifies a genuine X-Twilio-Signature and rejects a tampered body", () => {
    const params = twilioParams();
    const signature = computeTwilioSignature(AUTH_TOKEN, WEBHOOK_URL, params);
    expect(
      verifyTwilioSignature({ authToken: AUTH_TOKEN, url: WEBHOOK_URL, params, signature }),
    ).toBe(true);
    expect(
      verifyTwilioSignature({
        authToken: AUTH_TOKEN,
        url: WEBHOOK_URL,
        params: { ...params, Body: "attacker text" },
        signature,
      }),
    ).toBe(false);
    expect(
      verifyTwilioSignature({ authToken: AUTH_TOKEN, url: WEBHOOK_URL, params, signature: null }),
    ).toBe(false);
  });

  it("parses a form body and stages an untrusted ChannelMessage keyed by the sender", () => {
    const raw = new URLSearchParams(twilioParams()).toString();
    const params = parseSmsForm(raw);
    const parsed = SmsWebhookSchema.safeParse(params);
    expect(parsed.success).toBe(true);
    const message = buildSmsMessage({
      from: params.From,
      to: params.To,
      body: params.Body,
      messageSid: params.MessageSid,
      rawPayload: params,
    });
    expect(message.channelSlug).toBe("sms");
    expect(message.externalId).toBe("sms:+15551230001");
    expect(message.untrustedOrigin).toBe(true);
    expect(message.providerMessageId).toBe("SM123");
    expect(message.channelMeta).toMatchObject({ from: "+15551230001", to: "+15559990002" });
  });

  it("extracts MMS media descriptors from MediaUrl{i} pairs", () => {
    const media = readSmsMedia(
      twilioParams({
        NumMedia: "2",
        MediaUrl0: "https://api.twilio.com/media/0",
        MediaContentType0: "image/jpeg",
        MediaUrl1: "https://api.twilio.com/media/1",
        MediaContentType1: "image/png",
      }),
    );
    expect(media).toHaveLength(2);
    expect(media[0]).toEqual({ url: "https://api.twilio.com/media/0", contentType: "image/jpeg" });
  });

  it("matches the APPROVE / EDIT / REJECT text protocol on exact words only", () => {
    expect(matchProtocolCommand("APPROVE")).toBe("approve");
    expect(matchProtocolCommand(" approve. ")).toBe("approve");
    expect(matchProtocolCommand("Reject")).toBe("reject");
    expect(matchProtocolCommand("edit")).toBe("edit");
    expect(matchProtocolCommand("please approve the draft")).toBeNull();
  });
});

describe("sms outbound: send + forensics log", () => {
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

  it("appends the protocol footer to a staged reply and flattens buttons otherwise", () => {
    expect(
      renderSmsText({ text: "Drafted it.", staged: true, threadId: null, channelMeta: {} }),
    ).toBe(`Drafted it.\n\n${STAGED_PROTOCOL_FOOTER}`);
    expect(
      renderSmsText({
        text: "Held for approval.",
        buttons: [{ label: "Open Mission Control →", url: "https://x/mc" }],
        threadId: null,
        channelMeta: {},
      }),
    ).toBe("Held for approval.\n\nOpen Mission Control: https://x/mc");
  });

  it("sends via the Twilio Messages API and records the outbound pa_channel_messages row", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
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
        finalAnswer: "Jenny's invoice went out Tuesday.",
        toolSteps: [],
      })),
      recordMessage: vi.fn(async (p: { direction: "inbound" | "outbound"; body: string }) => {
        recorded.push({ direction: p.direction, body: p.body });
        return "msg-1";
      }),
      // The REAL adapter path: registry → smsAdapter.sendOutbound → the mocked Twilio fetch.
      send: (connection, response) => dispatchOutbound(connection, response),
      flagConnectionError: vi.fn(async () => {}),
      missionControlUrl: () => "https://aipocketagent.com/app/mission-control",
    };

    const raw = new URLSearchParams(twilioParams({ Body: "did Jenny's invoice go out?" })).toString();
    const params = parseSmsForm(raw);
    const outcome = await routeChannelMessage(
      buildSmsMessage({
        from: params.From,
        to: params.To,
        body: params.Body,
        messageSid: params.MessageSid,
        rawPayload: params,
      }),
      deps,
    );

    expect(outcome).toEqual({ handled: "replied", ok: true });
    // One Twilio Messages call, addressed back to the owner from the paired number.
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/AC${"a".repeat(32)}/Messages.json`,
    );
    const sentForm = new URLSearchParams(String(init.body));
    expect(sentForm.get("To")).toBe("+15551230001");
    expect(sentForm.get("From")).toBe("+15559990002");
    expect(sentForm.get("Body")).toBe("Jenny's invoice went out Tuesday.");
    // Both directions land in pa_channel_messages (inbound then outbound).
    expect(recorded).toEqual([
      { direction: "inbound", body: "did Jenny's invoice go out?" },
      { direction: "outbound", body: "Jenny's invoice went out Tuesday." },
    ]);
  });

  it("uses MessagingServiceSid over From when the connection carries one", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const connection = makeConnection({
      config: {
        accountSid: "AC" + "a".repeat(32),
        ownerPhone: "+15551230001",
        messagingServiceSid: "MG" + "b".repeat(32),
      },
    });
    await smsAdapter.sendOutbound(connection, {
      text: "hi",
      threadId: null,
      channelMeta: { from: "+15551230001", to: "+15559990002", surface: "im" },
    });
    const sentForm = new URLSearchParams(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(sentForm.get("MessagingServiceSid")).toBe("MG" + "b".repeat(32));
    expect(sentForm.get("From")).toBeNull();
  });
});
