import { afterEach, describe, expect, it } from "vitest";
import { buildColdSendPayload } from "../outbound";

const ORIGINAL = process.env.PA_PUBLIC_WHATSAPP_NUMBER;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PA_PUBLIC_WHATSAPP_NUMBER;
  else process.env.PA_PUBLIC_WHATSAPP_NUMBER = ORIGINAL;
});

const TO = "15551234567";

describe("buildColdSendPayload (Meta Cloud API shapes)", () => {
  it("builds a text payload and clips to the 4096 cap", () => {
    const payload = buildColdSendPayload(TO, { kind: "text", text: "x".repeat(5_000) });
    expect(payload).toMatchObject({ messaging_product: "whatsapp", to: TO, type: "text" });
    const text = (payload as { text: { body: string } }).text.body;
    expect(text.length).toBeLessThanOrEqual(4_096);
  });

  it("builds native reply buttons, at most 3, titles clipped to 20 chars", () => {
    const payload = buildColdSendPayload(TO, {
      kind: "buttons",
      text: "Pick one",
      buttons: [
        { id: "a", title: "A title that is far too long for WhatsApp" },
        { id: "b", title: "B" },
        { id: "c", title: "C" },
        { id: "d", title: "D" },
      ],
    });
    const interactive = (payload as {
      interactive: { action: { buttons: Array<{ reply: { id: string; title: string } }> } };
    }).interactive;
    expect(interactive.action.buttons).toHaveLength(3);
    expect(interactive.action.buttons[0].reply.title.length).toBeLessThanOrEqual(20);
  });

  it("builds the save-contact card as Pocket from the public number", () => {
    process.env.PA_PUBLIC_WHATSAPP_NUMBER = "+1 555 010 0000";
    const payload = buildColdSendPayload(TO, { kind: "contact_card" });
    expect(payload).toMatchObject({
      type: "contacts",
      contacts: [
        {
          name: { formatted_name: "Pocket" },
          org: { company: "Pocket Agent" },
          phones: [{ wa_id: "15550100000" }],
        },
      ],
    });
  });

  it("skips the contact card when the public number env is unset", () => {
    delete process.env.PA_PUBLIC_WHATSAPP_NUMBER;
    expect(buildColdSendPayload(TO, { kind: "contact_card" })).toBeNull();
  });
});
