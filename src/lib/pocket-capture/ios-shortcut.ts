// ios-shortcut.ts — constants for the published iOS Shortcut capture surface (PC-MARK-3 / PC-CORE-4).
//
// Chase publishes the actual ".shortcut" to the iCloud Shortcuts Gallery (PC-CORE-4) and drops its
// share URL into NEXT_PUBLIC_POCKET_CAPTURE_SHORTCUT_URL. Until then the install button points at a
// clearly-labelled placeholder so the wizard renders end-to-end without a dead import.

export const IOS_SHORTCUT_NAME = "Pocket Capture";

// The iCloud Shortcuts Gallery share link. PLACEHOLDER until PC-CORE-4 publishes the .shortcut and
// Chase sets the env var. The wizard disables the install button (and says so) when this is the
// placeholder, rather than deep-linking users to a 404.
export const IOS_SHORTCUT_PLACEHOLDER_URL = "https://www.icloud.com/shortcuts/PLACEHOLDER";

export function iosShortcutInstallUrl(): string {
  return process.env.NEXT_PUBLIC_POCKET_CAPTURE_SHORTCUT_URL ?? IOS_SHORTCUT_PLACEHOLDER_URL;
}

/** True when the install URL is still the unpublished placeholder (PC-CORE-4 not shipped yet). */
export function isShortcutPublished(url: string): boolean {
  return url !== IOS_SHORTCUT_PLACEHOLDER_URL && !url.includes("PLACEHOLDER");
}
