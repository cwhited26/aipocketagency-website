import { describe, expect, it, vi } from "vitest";
import { moderateColdInbound, moderationInternals } from "../moderation";
import type { ModerationDeps } from "../moderation";

function okCompletion(text: string) {
  return {
    ok: true as const,
    text,
    inputTokens: 10,
    outputTokens: 5,
    provider: "anthropic" as const,
    model: moderationInternals.MODERATION_MODEL,
    qualityWarning: false,
    usedFallback: false,
    fallbackReason: null,
  };
}

function makeDeps(overrides: Partial<ModerationDeps> = {}): ModerationDeps {
  return {
    complete: vi.fn(async () => okCompletion('{"verdict":"ok"}')),
    ledger: vi.fn(async () => undefined),
    ...overrides,
  };
}

const PARAMS = { senderPhone: "15551234567", text: "Setup a Sales agent for me", anthropicKey: "sk-test" };

describe("moderateColdInbound (§22.4 classifier gate)", () => {
  it("passes an ok verdict through without ledgering", async () => {
    const deps = makeDeps();
    const verdict = await moderateColdInbound(PARAMS, deps);
    expect(verdict).toEqual({ verdict: "ok" });
    expect(deps.ledger).not.toHaveBeenCalled();
  });

  it("declines and ledgers a flagged message", async () => {
    const deps = makeDeps({
      complete: vi.fn(async () => okCompletion('{"verdict":"decline","category":"abusive"}')),
    });
    const verdict = await moderateColdInbound({ ...PARAMS, text: "abusive text" }, deps);
    expect(verdict).toEqual({ verdict: "decline", category: "abusive" });
    expect(deps.ledger).toHaveBeenCalledWith({
      senderPhone: PARAMS.senderPhone,
      category: "abusive",
      body: "abusive text",
    });
  });

  it("maps an unknown decline category to other", async () => {
    const deps = makeDeps({
      complete: vi.fn(async () => okCompletion('{"verdict":"decline","category":"weird"}')),
    });
    const verdict = await moderateColdInbound(PARAMS, deps);
    expect(verdict).toEqual({ verdict: "decline", category: "other" });
  });

  it("fails CLOSED when the model call fails", async () => {
    const deps = makeDeps({
      complete: vi.fn(async () => ({ ok: false as const, status: 502, error: "down" })),
    });
    const verdict = await moderateColdInbound(PARAMS, deps);
    expect(verdict).toEqual({ verdict: "unavailable" });
    expect(deps.ledger).not.toHaveBeenCalled();
  });

  it("fails CLOSED on unparseable model output", async () => {
    const deps = makeDeps({ complete: vi.fn(async () => okCompletion("sure, that looks fine")) });
    const verdict = await moderateColdInbound(PARAMS, deps);
    expect(verdict).toEqual({ verdict: "unavailable" });
  });

  it("parses a verdict wrapped in stray prose", () => {
    expect(moderationInternals.parseVerdict('Here: {"verdict":"ok"} done')).toEqual({
      verdict: "ok",
    });
    expect(moderationInternals.parseVerdict("")).toBeNull();
    expect(moderationInternals.parseVerdict('{"verdict":"maybe"}')).toBeNull();
  });
});
