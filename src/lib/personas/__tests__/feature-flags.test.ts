import { describe, it, expect, afterEach } from "vitest";
import { comingSoon503, publicModesEnabled, PUBLIC_MODES_COMING_SOON } from "../feature-flags";

describe("publicModesEnabled", () => {
  const saved = process.env.PA_PERSONAS_PUBLIC_MODES_ENABLED;
  afterEach(() => {
    if (saved === undefined) delete process.env.PA_PERSONAS_PUBLIC_MODES_ENABLED;
    else process.env.PA_PERSONAS_PUBLIC_MODES_ENABLED = saved;
  });

  it("is OFF when the env var is unset", () => {
    delete process.env.PA_PERSONAS_PUBLIC_MODES_ENABLED;
    expect(publicModesEnabled()).toBe(false);
  });

  it("is OFF for any value other than the exact string 'true'", () => {
    for (const v of ["false", "1", "TRUE", "yes", "on", ""]) {
      process.env.PA_PERSONAS_PUBLIC_MODES_ENABLED = v;
      expect(publicModesEnabled(), `value ${JSON.stringify(v)}`).toBe(false);
    }
  });

  it("is ON only for the exact string 'true'", () => {
    process.env.PA_PERSONAS_PUBLIC_MODES_ENABLED = "true";
    expect(publicModesEnabled()).toBe(true);
  });
});

describe("comingSoon503", () => {
  it("returns a 503 with the coming-soon body", async () => {
    const res = comingSoon503();
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; comingSoon: boolean };
    expect(body.comingSoon).toBe(true);
    expect(body.error).toBe(PUBLIC_MODES_COMING_SOON);
  });
});
