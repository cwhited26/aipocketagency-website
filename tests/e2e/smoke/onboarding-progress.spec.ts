// onboarding-progress.spec.ts — PA-POS-36 smoke: the progress read and the starter skip both
// gate on auth. Auth is checked before the body parse, so 401 is the expected anonymous outcome
// on every request shape. Auth-less Playwright convention per smoke.spec.ts.

import { test, expect } from "@playwright/test";

test.describe("onboarding progress (PA-POS-36)", () => {
  test("progress read requires auth", async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/api/app/onboarding/progress`);
    expect(res.status()).toBe(401);
  });

  test("starter step skip requires auth", async ({ request, baseURL }) => {
    const res = await request.post(`${baseURL}/api/app/onboarding/steps/skip`, {
      data: { step: "invite_teammate" },
    });
    expect(res.status()).toBe(401);
  });
});
