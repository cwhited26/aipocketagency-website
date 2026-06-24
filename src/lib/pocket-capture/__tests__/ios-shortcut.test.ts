import { afterEach, describe, expect, it } from "vitest";
import {
  IOS_SHORTCUT_PLACEHOLDER_URL,
  iosShortcutInstallUrl,
  isShortcutPublished,
} from "../ios-shortcut";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_POCKET_CAPTURE_SHORTCUT_URL;
});

describe("isShortcutPublished", () => {
  it("treats the placeholder as unpublished", () => {
    expect(isShortcutPublished(IOS_SHORTCUT_PLACEHOLDER_URL)).toBe(false);
    expect(isShortcutPublished("https://example.com/shortcuts/PLACEHOLDER-foo")).toBe(false);
  });
  it("treats a real iCloud link as published", () => {
    expect(isShortcutPublished("https://www.icloud.com/shortcuts/abc123")).toBe(true);
  });
});

describe("iosShortcutInstallUrl", () => {
  it("returns the placeholder when the env var is unset", () => {
    expect(iosShortcutInstallUrl()).toBe(IOS_SHORTCUT_PLACEHOLDER_URL);
  });
  it("returns the configured URL when published", () => {
    process.env.NEXT_PUBLIC_POCKET_CAPTURE_SHORTCUT_URL = "https://www.icloud.com/shortcuts/real";
    expect(iosShortcutInstallUrl()).toBe("https://www.icloud.com/shortcuts/real");
    expect(isShortcutPublished(iosShortcutInstallUrl())).toBe(true);
  });
});
