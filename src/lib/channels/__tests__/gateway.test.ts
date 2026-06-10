// Routing tests for the Channels Gateway inbound router (PA-CHAN-1/5/6/7) — fully mocked deps, no
// DB / network / LLM. Covers owner resolve, tier gate, no-API-key, the simple→inline-answer branch,
// the dispatched / gated staged-reply branch (Mission Control link), staged-tool detection, the
// untrusted_origin flag reaching the dispatcher, and the auth-error reconnect flag.

import { describe, expect, it, vi } from "vitest";
import { routeChannelMessage, type GatewayDeps } from "../gateway";
import type { ChannelConnection, ChannelMessage, ChannelResponse } from "../types";
import type { PaUser } from "@/lib/pa-supabase";
import type { DispatchOutcome } from "@/lib/orchestrator/types";
import type { ConversationTurnResult } from "@/lib/chat/conversation-agent";

function makeConnection(over: Partial<ChannelConnection> = {}): ChannelConnection {
  return {
    id: "conn-1",
    ownerId: "owner-1",
    channelSlug: "slack",
    externalId: "T1:U9",
    personaId: null,
    authToken: "xoxb-test",
    config: {},
    enabled: true,
    ...over,
  };
}

function makeMessage(over: Partial<ChannelMessage> = {}): ChannelMessage {
  return {
    channelSlug: "slack",
    externalId: "T1:U9",
    body: "draft a follow-up to the client",
    threadId: null,
    untrustedOrigin: true,
    channelMeta: { channel: "D1", threadTs: null, surface: "im" },
    rawPayload: {},
    ...over,
  };
}

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

function makeDeps(over: Partial<GatewayDeps> = {}): GatewayDeps {
  const sent: ChannelResponse[] = [];
  const base: GatewayDeps = {
    resolveConnection: vi.fn(async () => makeConnection()),
    getTier: vi.fn(async () => "pro" as const),
    loadPaUser: vi.fn(async () => PA_USER),
    resolveRunZone: vi.fn(async () => "project-shared"),
    ensureConversationId: vi.fn(async () => "conv-1"),
    dispatchGoal: vi.fn(
      async (): Promise<DispatchOutcome> => ({ kind: "simple", reason: "quick lookup" }),
    ),
    chatTurn: vi.fn(
      async (): Promise<ConversationTurnResult> => ({
        ok: true,
        finalAnswer: "Here's your answer.",
        toolSteps: [],
      }),
    ),
    recordMessage: vi.fn(async () => "msg-1"),
    send: vi.fn(async (_c: ChannelConnection, r: ChannelResponse) => {
      sent.push(r);
      return { ok: true as const };
    }),
    flagConnectionError: vi.fn(async () => {}),
    missionControlUrl: () => "https://aipocketagent.com/app/mission-control",
  };
  return { ...base, ...over };
}

describe("routeChannelMessage", () => {
  it("ignores an unknown sender (no connection)", async () => {
    const deps = makeDeps({ resolveConnection: vi.fn(async () => null) });
    const res = await routeChannelMessage(makeMessage(), deps);
    expect(res).toEqual({ handled: "unknown_sender" });
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("refuses a downgraded owner below the channel tier (no dispatch, no cost)", async () => {
    const deps = makeDeps({ getTier: vi.fn(async () => "starter" as const) });
    const res = await routeChannelMessage(makeMessage(), deps);
    expect(res).toEqual({ handled: "tier_blocked" });
    expect(deps.dispatchGoal).not.toHaveBeenCalled();
    expect(deps.send).toHaveBeenCalledOnce();
  });

  it("tells the owner in-place when no Anthropic key is set", async () => {
    const noKey = { ...PA_USER, anthropic_api_key: null };
    const deps = makeDeps({ loadPaUser: vi.fn(async () => noKey) });
    const res = await routeChannelMessage(makeMessage(), deps);
    expect(res.handled).toBe("no_api_key");
    expect(deps.dispatchGoal).not.toHaveBeenCalled();
  });

  it("answers a simple goal inline and flags untrusted_origin to the dispatcher", async () => {
    const deps = makeDeps();
    const res = await routeChannelMessage(makeMessage(), deps);
    expect(res).toEqual({ handled: "replied", ok: true });
    // untrusted_origin propagated (PA-CHAN-5).
    expect(deps.dispatchGoal).toHaveBeenCalledWith(
      expect.objectContaining({ untrustedOrigin: true, businessId: "owner-1" }),
    );
    // Inline answer metered as channels:slack (PA-CHAN §8.4).
    expect(deps.chatTurn).toHaveBeenCalledWith(
      expect.objectContaining({ cost: expect.objectContaining({ featureSlug: "channels:slack" }) }),
    );
    const reply = (deps.send as ReturnType<typeof vi.fn>).mock.calls[0][1] as ChannelResponse;
    expect(reply.text).toBe("Here's your answer.");
    expect(reply.buttons).toBeUndefined();
  });

  it("surfaces a Mission Control button when the inline answer staged a draft", async () => {
    const deps = makeDeps({
      chatTurn: vi.fn(async () => ({
        ok: true as const,
        finalAnswer: "Drafted it.",
        toolSteps: [{ tool: "draft_email", label: "Drafted email" }],
      })),
    });
    await routeChannelMessage(makeMessage(), deps);
    const reply = (deps.send as ReturnType<typeof vi.fn>).mock.calls[0][1] as ChannelResponse;
    expect(reply.buttons?.[0].url).toBe("https://aipocketagent.com/app/mission-control");
  });

  it("replies with the staged-action reason + Mission Control link for a dispatched goal", async () => {
    const deps = makeDeps({
      dispatchGoal: vi.fn(async () => ({
        kind: "dispatched" as const,
        runId: "r1",
        scaffold: { project: "p", definitionOfDone: "d", successCriteria: [], milestones: [] },
        dispatched: true,
        reason: "On it — I'll stage anything external for your approval.",
      })),
    });
    await routeChannelMessage(makeMessage(), deps);
    // No inline chat call on the dispatched branch.
    expect(deps.chatTurn).not.toHaveBeenCalled();
    const reply = (deps.send as ReturnType<typeof vi.fn>).mock.calls[0][1] as ChannelResponse;
    expect(reply.text).toContain("stage anything external");
    expect(reply.buttons?.[0].url).toBe("https://aipocketagent.com/app/mission-control");
  });

  it("flags the connection for reconnect on a hard auth failure when sending", async () => {
    const deps = makeDeps({
      send: vi.fn(async () => ({ ok: false as const, authError: true, error: "token_revoked" })),
    });
    const res = await routeChannelMessage(makeMessage(), deps);
    expect(res).toEqual({ handled: "replied", ok: false });
    expect(deps.flagConnectionError).toHaveBeenCalledWith("conn-1");
  });

  it("does not answer when the connection is disabled", async () => {
    const deps = makeDeps({ resolveConnection: vi.fn(async () => makeConnection({ enabled: false })) });
    const res = await routeChannelMessage(makeMessage(), deps);
    expect(res).toEqual({ handled: "disabled" });
    expect(deps.send).not.toHaveBeenCalled();
  });
});
