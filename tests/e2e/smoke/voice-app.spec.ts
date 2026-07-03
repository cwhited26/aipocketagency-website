// voice-app.spec.ts — Voice v2 smoke (PA-CHAN-15/16): the App page renders, the inbound webhook
// speaks TwiML to a correctly signed request, and a forged signature gets a hard 401.
//
// Conventions from smoke.spec.ts: auth-less Playwright means /app/* redirecting to /app/login is
// a healthy outcome. The valid-signature case needs the target's real TWILIO_AUTH_TOKEN to compute
// the HMAC, so it runs only when the runner has it (local: TWILIO_AUTH_TOKEN=… NEXT_PUBLIC_APP_URL=…
// pnpm smoke) and skips otherwise — the 401-on-forged case runs against any target.

import crypto from "node:crypto";
import { test, expect } from "@playwright/test";

const INBOUND_PATH = "/api/channels/inbound/voice";

const WEBHOOK_PARAMS: Record<string, string> = {
  CallSid: "CA-smoke-voice-1",
  AccountSid: "AC-smoke",
  From: "+14045550000",
  To: "+14045559999",
  CallStatus: "ringing",
  Direction: "inbound",
};

function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  let data = url;
  for (const key of Object.keys(params).sort()) data += key + params[key];
  return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
}

test.describe("voice app", () => {
  test("/app/apps/voice renders (empty state or healthy login redirect)", async ({ page }) => {
    const response = await page.goto("/app/apps/voice", { waitUntil: "domcontentloaded" });
    expect(response, "no response for /app/apps/voice").toBeTruthy();
    expect(response!.status(), "expected a rendered page (200 after any redirect)").toBe(200);

    const url = page.url();
    if (url.includes("/app/login")) {
      // Auth-less run — the gate held and the login page rendered. Healthy.
      await expect(page.locator("body")).toContainText(/log in|sign in|email/i);
      return;
    }
    // Authed target (or public rendering) — the Voice surface itself.
    await expect(page.locator("h1")).toContainText(/Poc answers your phone/i);
    await expect(page.locator("body")).toContainText(/No calls yet|call/i);
  });

  test("inbound voice webhook rejects a forged signature with 401", async ({ request, baseURL }) => {
    const res = await request.post(`${baseURL}${INBOUND_PATH}`, {
      form: WEBHOOK_PARAMS,
      headers: { "X-Twilio-Signature": "forged-signature" },
    });
    expect(res.status()).toBe(401);
  });

  test("inbound voice webhook returns TwiML for a correctly signed request", async ({
    request,
    baseURL,
  }) => {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    test.skip(!authToken, "TWILIO_AUTH_TOKEN not available to the test runner");

    // The route verifies against its canonical public URL (PA_OAUTH_REDIRECT_BASE); for a local
    // run point both at the same origin.
    const signedUrl = `${(process.env.PA_OAUTH_REDIRECT_BASE ?? baseURL ?? "").replace(/\/$/, "")}${INBOUND_PATH}`;
    const res = await request.post(`${baseURL}${INBOUND_PATH}`, {
      form: WEBHOOK_PARAMS,
      headers: { "X-Twilio-Signature": twilioSignature(authToken!, signedUrl, WEBHOOK_PARAMS) },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] ?? "").toContain("xml");
    const body = await res.text();
    // Flag off → spoken decline; flag on → media stream or a spoken gate line. All are TwiML.
    expect(body).toContain("<Response>");
  });
});
