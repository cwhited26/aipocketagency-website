import { afterEach, describe, expect, it } from "vitest";
import { coldWhatsappConfig, isColdInboundNumber, publicWhatsappNumber } from "../config";

const ENV_KEYS = [
  "PA_PUBLIC_WHATSAPP_NUMBER",
  "PA_PUBLIC_WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_APP_SECRET",
  "ANTHROPIC_API_KEY",
] as const;

const ORIGINAL = new Map(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of ENV_KEYS) {
    const v = ORIGINAL.get(k);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function setAll(): void {
  process.env.PA_PUBLIC_WHATSAPP_NUMBER = "+1 (555) 010-0000";
  process.env.PA_PUBLIC_WHATSAPP_PHONE_NUMBER_ID = "PUBLIC_PNID";
  process.env.WHATSAPP_ACCESS_TOKEN = "token";
  process.env.WHATSAPP_APP_SECRET = "secret";
  process.env.ANTHROPIC_API_KEY = "sk-test";
}

describe("cold-inbound routing config (§22.4 number cap)", () => {
  it("is dark until every env piece is set", () => {
    setAll();
    delete process.env.PA_PUBLIC_WHATSAPP_PHONE_NUMBER_ID;
    expect(coldWhatsappConfig()).toBeNull();
    setAll();
    delete process.env.WHATSAPP_APP_SECRET;
    expect(coldWhatsappConfig()).toBeNull();
    setAll();
    expect(coldWhatsappConfig()).not.toBeNull();
  });

  it("routes cold ONLY for the PA public Phone Number ID", () => {
    setAll();
    const config = coldWhatsappConfig();
    if (!config) throw new Error("config expected");
    expect(isColdInboundNumber("PUBLIC_PNID", config)).toBe(true);
    expect(isColdInboundNumber(" PUBLIC_PNID ", config)).toBe(true);
    expect(isColdInboundNumber("SOME_CUSTOMER_PNID", config)).toBe(false);
  });

  it("normalizes the display number for wa.me and hides when unset", () => {
    setAll();
    expect(publicWhatsappNumber()).toBe("15550100000");
    delete process.env.PA_PUBLIC_WHATSAPP_NUMBER;
    expect(publicWhatsappNumber()).toBeNull();
  });
});
