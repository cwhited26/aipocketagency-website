// Unit tests for the Signal Catcher classifier (lib/signal-catcher/classify classifySignal) — the
// one cheap Haiku call that reads an owner chat message for a standing wish. Contract under test:
// (a) a valid JSON verdict comes back Zod-validated, (b) fenced JSON is tolerated, (c) non-JSON /
// schema-violating / API-error / no-key / too-short inputs all degrade to null without throwing,
// and (d) every call that reaches the model logs exactly one cost event with the signal_catcher
// slug. Anthropic + the cost ledger run against mocks so no network is touched.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cost/log", () => ({
  logCostFromUsage: vi.fn(async () => undefined),
}));

import { logCostFromUsage } from "@/lib/cost/log";
import { classifySignal, MIN_CLASSIFIABLE_LENGTH } from "../classify";

const MESSAGE = "I keep meaning to check my pipeline every Monday morning before standup";

const VALID = {
  signal_type: "recurring_task",
  confidence: 0.86,
  suggested_ritual_name: "Monday Pipeline Review",
  suggested_cadence: "every Monday at 8am",
  suggested_app_slug: "lead-scout",
};

function mockAnthropic(body: string, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: body }],
          usage: { input_tokens: 210, output_tokens: 60 },
        }),
        { status },
      ),
    ),
  );
}

beforeEach(() => vi.mocked(logCostFromUsage).mockClear());
afterEach(() => vi.restoreAllMocks());

describe("classifySignal", () => {
  it("returns the Zod-validated verdict on clean JSON", async () => {
    mockAnthropic(JSON.stringify(VALID));
    const got = await classifySignal({ apiKey: "k", message: MESSAGE });
    expect(got).toEqual(VALID);
  });

  it("tolerates a ```json fence around the object", async () => {
    mockAnthropic("```json\n" + JSON.stringify(VALID) + "\n```");
    const got = await classifySignal({ apiKey: "k", message: MESSAGE });
    expect(got?.signal_type).toBe("recurring_task");
  });

  it("defaults the optional fields when the model omits them on not_a_signal", async () => {
    mockAnthropic(JSON.stringify({ signal_type: "not_a_signal", confidence: 0.1 }));
    const got = await classifySignal({ apiKey: "k", message: MESSAGE });
    expect(got).toEqual({
      signal_type: "not_a_signal",
      confidence: 0.1,
      suggested_ritual_name: "",
      suggested_cadence: "",
      suggested_app_slug: "",
    });
  });

  it("returns null on non-JSON output", async () => {
    mockAnthropic("Sure! Here's what I think about that message…");
    expect(await classifySignal({ apiKey: "k", message: MESSAGE })).toBeNull();
  });

  it("returns null when the JSON violates the schema (confidence out of range)", async () => {
    mockAnthropic(JSON.stringify({ ...VALID, confidence: 1.7 }));
    expect(await classifySignal({ apiKey: "k", message: MESSAGE })).toBeNull();
  });

  it("returns null when signal_type is not in the enum", async () => {
    mockAnthropic(JSON.stringify({ ...VALID, signal_type: "vibe" }));
    expect(await classifySignal({ apiKey: "k", message: MESSAGE })).toBeNull();
  });

  it("returns null on an API error and logs no cost", async () => {
    mockAnthropic(JSON.stringify(VALID), 500);
    expect(
      await classifySignal({
        apiKey: "k",
        message: MESSAGE,
        cost: { ownerId: "o1", featureSlug: "signal_catcher", idempotencyKey: "signal_catcher:classify:m1" },
      }),
    ).toBeNull();
    expect(logCostFromUsage).not.toHaveBeenCalled();
  });

  it("short-circuits with no API key and never calls fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await classifySignal({ apiKey: null, message: MESSAGE })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips messages shorter than the classifiable floor without a call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const short = "ok thanks";
    expect(short.length).toBeLessThan(MIN_CLASSIFIABLE_LENGTH);
    expect(await classifySignal({ apiKey: "k", message: short })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("logs one signal_catcher cost event with the model's token usage", async () => {
    mockAnthropic(JSON.stringify(VALID));
    await classifySignal({
      apiKey: "k",
      message: MESSAGE,
      cost: { ownerId: "o1", featureSlug: "signal_catcher", idempotencyKey: "signal_catcher:classify:m1" },
    });
    expect(logCostFromUsage).toHaveBeenCalledTimes(1);
    expect(logCostFromUsage).toHaveBeenCalledWith(
      { ownerId: "o1", featureSlug: "signal_catcher", idempotencyKey: "signal_catcher:classify:m1" },
      "anthropic",
      "claude-haiku-4-5-20251001",
      { tokensInput: 210, tokensOutput: 60 },
    );
  });
});
