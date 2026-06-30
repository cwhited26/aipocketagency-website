// Tests for the Telegram adapter (PA-CHAN-1/5): the structural inbound classifier (text / voice /
// document / ignore paths, untrusted_origin always set), the normalized-message builder, and the
// outbound sendMessage request shape (mocked fetch — no network).

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTelegramMessage, telegramAdapter, telegramExternalId } from "../adapter";
import { classifyTelegramUpdate } from "../types";
import type { ChannelConnection } from "@/lib/channels/types";

const BOT_ID = "555000111";

function update(message: Record<string, unknown> | null): string {
  return JSON.stringify(message === null ? { update_id: 42 } : { update_id: 42, message });
}

const PRIVATE_CHAT = { id: 987654, type: "private" };

describe("classifyTelegramUpdate", () => {
  it("classifies a private text DM (untrusted, with ids threaded through)", () => {
    const res = classifyTelegramUpdate(
      update({ message_id: 7, chat: PRIVATE_CHAT, from: { id: 1 }, text: "  draft a reply to Sam  " }),
      BOT_ID,
    );
    expect(res.kind).toBe("text");
    if (res.kind !== "text") throw new Error("expected text");
    expect(res.text).toBe("draft a reply to Sam");
    expect(res.botId).toBe(BOT_ID);
    expect(res.chatId).toBe(987654);
    expect(res.messageId).toBe(7);
    expect(res.updateId).toBe(42);
  });

  it("classifies a voice note, carrying the file ref + caption", () => {
    const res = classifyTelegramUpdate(
      update({
        message_id: 8,
        chat: PRIVATE_CHAT,
        from: { id: 1 },
        caption: "listen to this",
        voice: { file_id: "VOICE1", file_unique_id: "u1", mime_type: "audio/ogg", duration: 5 },
      }),
      BOT_ID,
    );
    expect(res.kind).toBe("voice");
    if (res.kind !== "voice") throw new Error("expected voice");
    expect(res.file.fileId).toBe("VOICE1");
    expect(res.file.mimeType).toBe("audio/ogg");
    expect(res.caption).toBe("listen to this");
  });

  it("classifies a document, carrying the file name + ref", () => {
    const res = classifyTelegramUpdate(
      update({
        message_id: 9,
        chat: PRIVATE_CHAT,
        from: { id: 1 },
        document: { file_id: "DOC1", file_unique_id: "d1", file_name: "q3.pdf", mime_type: "application/pdf" },
      }),
      BOT_ID,
    );
    expect(res.kind).toBe("document");
    if (res.kind !== "document") throw new Error("expected document");
    expect(res.file.fileId).toBe("DOC1");
    expect(res.file.fileName).toBe("q3.pdf");
  });

  it("ignores a non-private (group) chat", () => {
    const res = classifyTelegramUpdate(
      update({ message_id: 10, chat: { id: -100, type: "supergroup" }, from: { id: 1 }, text: "hi" }),
      BOT_ID,
    );
    expect(res).toEqual({ kind: "ignore", reason: "chat_type:supergroup" });
  });

  it("ignores a message authored by another bot (loop guard)", () => {
    const res = classifyTelegramUpdate(
      update({ message_id: 11, chat: PRIVATE_CHAT, from: { id: 2, is_bot: true }, text: "echo" }),
      BOT_ID,
    );
    expect(res).toEqual({ kind: "ignore", reason: "bot_author" });
  });

  it("ignores an update with no message (e.g. edited_message / callback_query)", () => {
    const res = classifyTelegramUpdate(update(null), BOT_ID);
    expect(res).toEqual({ kind: "ignore", reason: "non_message_update" });
  });

  it("ignores an empty text message", () => {
    const res = classifyTelegramUpdate(
      update({ message_id: 12, chat: PRIVATE_CHAT, from: { id: 1 }, text: "   " }),
      BOT_ID,
    );
    expect(res).toEqual({ kind: "ignore", reason: "empty_message" });
  });

  it("ignores an invalid JSON body without throwing", () => {
    expect(classifyTelegramUpdate("{not json", BOT_ID)).toEqual({ kind: "ignore", reason: "invalid_json" });
  });
});

describe("buildTelegramMessage", () => {
  it("builds an untrusted, in-place-threaded ChannelMessage with a stable provider id", () => {
    const msg = buildTelegramMessage({
      botId: BOT_ID,
      chatId: 987654,
      messageId: 7,
      updateId: 42,
      body: "hello",
      rawPayload: { update_id: 42 },
    });
    expect(msg.channelSlug).toBe("telegram");
    expect(msg.externalId).toBe(telegramExternalId(BOT_ID));
    expect(msg.untrustedOrigin).toBe(true);
    expect(msg.threadId).toBe("7");
    expect(msg.providerMessageId).toBe(`${BOT_ID}:42`);
    expect(msg.channelMeta).toMatchObject({ chatId: 987654, messageId: 7, surface: "im" });
  });
});

describe("telegramAdapter.sendOutbound", () => {
  afterEach(() => vi.restoreAllMocks());

  function connection(over: Partial<ChannelConnection> = {}): ChannelConnection {
    return {
      id: "conn-tg",
      ownerId: "owner-1",
      channelSlug: "telegram",
      externalId: telegramExternalId(BOT_ID),
      personaId: null,
      authToken: "BOTTOKEN",
      config: {},
      enabled: true,
      ...over,
    };
  }

  it("POSTs sendMessage to the bot endpoint with chat_id, reply threading, and an inline URL keyboard", async () => {
    const fetchMock = vi.fn(async () => ({
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 99, chat: { id: 987654 } } }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await telegramAdapter.sendOutbound(connection(), {
      text: "Drafted. Open Mission Control to send.",
      buttons: [{ label: "Open Mission Control →", url: "https://aipocketagent.com/app/mission-control" }],
      threadId: "7",
      channelMeta: { chatId: 987654, messageId: 7, surface: "im" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = call[0] as string;
    const init = call[1] as { method: string; body: string };
    expect(url).toBe("https://api.telegram.org/botBOTTOKEN/sendMessage");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.chat_id).toBe(987654);
    expect(body.text).toContain("Drafted.");
    expect(body.reply_to_message_id).toBe(7);
    expect(body.reply_markup).toEqual({
      inline_keyboard: [[{ text: "Open Mission Control →", url: "https://aipocketagent.com/app/mission-control" }]],
    });
  });

  it("throws an auth ChannelSendError when the connection has no token", async () => {
    await expect(
      telegramAdapter.sendOutbound(connection({ authToken: null }), {
        text: "hi",
        threadId: null,
        channelMeta: { chatId: 1 },
      }),
    ).rejects.toMatchObject({ name: "ChannelSendError", authError: true });
  });

  it("throws a non-auth ChannelSendError when no chat id is present", async () => {
    await expect(
      telegramAdapter.sendOutbound(connection(), { text: "hi", threadId: null, channelMeta: {} }),
    ).rejects.toMatchObject({ name: "ChannelSendError", authError: false });
  });
});
