import { describe, it, expect, beforeEach } from "vitest";
import {
  computeIdempotencyKey,
  markAndCheckDuplicate,
  bucketTimestamp,
  __resetIdempotencyCacheForTests,
  BUCKET_SECONDS,
} from "../idempotency";

const BASE = 1_700_000_000_000; // fixed wall-clock for deterministic buckets

describe("bucketTimestamp", () => {
  it("floors to the 5-second bucket", () => {
    expect(bucketTimestamp(BASE)).toBe(bucketTimestamp(BASE + 4_999));
    expect(bucketTimestamp(BASE)).not.toBe(bucketTimestamp(BASE + BUCKET_SECONDS * 1000));
  });
});

describe("computeIdempotencyKey", () => {
  it("is identical for the same share inside one bucket", () => {
    const a = computeIdempotencyKey({ ownerId: "u1", text: "hi", nowMs: BASE });
    const b = computeIdempotencyKey({ ownerId: "u1", text: "hi", nowMs: BASE + 4_000 });
    expect(a).toBe(b);
  });

  it("differs once the share crosses into the next bucket", () => {
    const a = computeIdempotencyKey({ ownerId: "u1", text: "hi", nowMs: BASE });
    const b = computeIdempotencyKey({
      ownerId: "u1",
      text: "hi",
      nowMs: BASE + BUCKET_SECONDS * 1000,
    });
    expect(a).not.toBe(b);
  });

  it("differs by owner", () => {
    const a = computeIdempotencyKey({ ownerId: "u1", text: "hi", nowMs: BASE });
    const b = computeIdempotencyKey({ ownerId: "u2", text: "hi", nowMs: BASE });
    expect(a).not.toBe(b);
  });

  it("differs by any content field", () => {
    const base = computeIdempotencyKey({ ownerId: "u1", text: "hi", nowMs: BASE });
    expect(computeIdempotencyKey({ ownerId: "u1", text: "bye", nowMs: BASE })).not.toBe(base);
    expect(computeIdempotencyKey({ ownerId: "u1", text: "hi", title: "T", nowMs: BASE })).not.toBe(
      base,
    );
    expect(
      computeIdempotencyKey({ ownerId: "u1", text: "hi", url: "https://x", nowMs: BASE }),
    ).not.toBe(base);
  });
});

describe("markAndCheckDuplicate", () => {
  beforeEach(() => __resetIdempotencyCacheForTests());

  it("treats the first hit as fresh and the immediate re-fire as a duplicate", () => {
    const key = computeIdempotencyKey({ ownerId: "u1", text: "x", nowMs: BASE });
    expect(markAndCheckDuplicate(key, BASE)).toBe(false); // fresh
    expect(markAndCheckDuplicate(key, BASE + 1_000)).toBe(true); // duplicate within TTL
  });

  it("accepts the key again once its TTL has lapsed", () => {
    const key = computeIdempotencyKey({ ownerId: "u1", text: "x", nowMs: BASE });
    expect(markAndCheckDuplicate(key, BASE, 1_000)).toBe(false);
    expect(markAndCheckDuplicate(key, BASE + 2_000, 1_000)).toBe(false); // expired → fresh again
  });

  it("keeps distinct keys independent", () => {
    const a = computeIdempotencyKey({ ownerId: "u1", text: "a", nowMs: BASE });
    const b = computeIdempotencyKey({ ownerId: "u1", text: "b", nowMs: BASE });
    expect(markAndCheckDuplicate(a, BASE)).toBe(false);
    expect(markAndCheckDuplicate(b, BASE)).toBe(false); // different content → not a duplicate
  });
});
