# Pocket Agent Capture (Mac) — v0.1

A macOS menu-bar app that auto-captures your **clipboard** and **screenshots** and syncs them to your
Pocket Agent brain. It's the frictionless capture layer on top of PA's existing capture pipeline —
the same backend the email/SMS/iOS-Shortcut surfaces write to.

- **Menu-bar only** (no dock icon). Click the icon for the popover.
- **Clipboard watcher** — polls every 1s; snapshots text / URLs / images / copied files, tagged with
  the frontmost app name.
- **Screenshot watcher** — watches `~/Pictures/Screenshots` and `~/Desktop` for new PNG/JPG files.
- **Privacy first** — per-watcher toggles, allow/deny by source app, pause, and a hard quit. Nothing
  leaves your Mac until it syncs to **your own** brain repo.
- **Local queue** — captures go to a SQLite queue at
  `~/Library/Application Support/Pocket Agent Capture/queue.db`, deduped by content hash, and are
  batch-uploaded every 30s. Synced rows are pruned after 7 days.

## How it connects to Pocket Agent

The app authenticates with your **personal API token** (`pca_…`) — the *same* token the iOS Shortcut
uses. Mint one in the web app at **Captures → Settings → API tokens** (shown once), then paste it into
the popover's Settings. It's stored in the **macOS Keychain**, never on disk.

Captures upload to `POST /api/capture/mac-sync` on the PA web app. The token resolves your account; the
server writes each item into your brain's `memory/inbox.md` (tagged `source="mac_app"`), staging
binaries (screenshots/files) in Supabase Storage. See the endpoint contract below.

## Develop

```bash
npm install
npm run gen:icons     # regenerate the tray + app icons (committed; only needed if you change them)
npm run typecheck     # tsc --noEmit for both the main + renderer projects
npm test              # vitest: hash dedup, allow/deny matcher, queue prune
npm start             # build + launch the app locally
```

The app posts to `https://aipocketagent.com` by default. Point it at a dev server by editing
`apiBaseUrl` in `~/Library/Application Support/Pocket Agent Capture/settings.json`.

## Build a DMG

```bash
npm run dist            # host-arch DMG → release/Pocket Agent Capture-0.1.0-arm64.dmg
npm run dist:universal  # universal (arm64 + x64) DMG — the release target (see caveat below)
```

`npm run dist` produces an **unsigned, un-notarized** arm64 DMG — fine for local testing on Apple
Silicon. On first launch macOS Gatekeeper will block it; right-click the app → **Open** to run it.

> **Universal build caveat.** `dist:universal` currently fails at the `lipo` merge step because
> `active-win`'s prebuilt native binary is arm64-only in a default `npm install` on an Apple Silicon
> machine, so `@electron/universal` has nothing to fat-merge with the x64 slice. To produce the
> universal DMG for release, install the x64 native binaries too (e.g. build on/with both arch
> prebuilds available, or `npm rebuild --arch=x64` active-win/better-sqlite3/keytar before
> `dist:universal`). This is a packaging step for the signing/release machine, not a code issue — the
> app compiles, tests pass, and the per-arch DMG builds and runs.

## Code signing + notarization (required before distribution)

The v0.1 build is intentionally unsigned. To distribute it you need an **Apple Developer account**
($99/yr) and a **Developer ID Application** certificate. Steps:

1. **Get the certificate.** In Xcode → Settings → Accounts, or via
   `https://developer.apple.com/account/resources/certificates`, create a *Developer ID Application*
   certificate and install it in your login Keychain.

2. **Create an app-specific password** for notarization at `https://appleid.apple.com` (Sign-In &
   Security → App-Specific Passwords), and note your Team ID.

3. **Set the signing env vars** before `npm run dist`:

   ```bash
   export CSC_NAME="Developer ID Application: Your Name (TEAMID)"   # or CSC_LINK + CSC_KEY_PASSWORD for a .p12
   export APPLE_ID="you@example.com"
   export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
   export APPLE_TEAM_ID="TEAMID"
   ```

   electron-builder signs with the Hardened Runtime entitlements in `build/entitlements.mac.plist`
   (already configured for Electron's JIT) and, when the Apple env vars are present, notarizes and
   staples the DMG automatically.

4. **Verify** the result:

   ```bash
   spctl -a -vvv -t install "release/Pocket Agent Capture-0.1.0-universal.dmg"
   codesign --verify --deep --strict --verbose=2 "release/mac-universal/Pocket Agent Capture.app"
   ```

## Distribution

Host the signed, notarized DMG and serve it from the web app at `/downloads/pa-capture-mac.dmg`
(the Settings → Mac Capture App page links there). Pick a host — Supabase Storage, Vercel Blob, or
Cloudflare R2 — and either upload to `public/downloads/` or add a redirect/rewrite from
`/downloads/pa-capture-mac.dmg` to the blob URL.

> Auto-update is **not** in v0.1 — distribution is a manual download. v1.1 will add
> electron-builder's auto-updater + a signed update feed.

## Endpoint contract — `POST /api/capture/mac-sync`

Request:

```http
POST /api/capture/mac-sync
Authorization: Bearer pca_<token>
Content-Type: application/json

{
  "items": [
    {
      "kind": "text" | "url" | "image" | "file",
      "content": "<raw text for text/url; base64 of the bytes for image/file>",
      "filename": "shot.png | null",      // required for image/file
      "mimeType": "image/png | null",
      "sourceApp": "Safari | null",
      "capturedAt": "2026-06-30T12:00:00.000Z",   // ISO-8601
      "hash": "<64-char hex SHA-256 of the content>"
    }
  ]
}
```

Response (`200`):

```json
{
  "success": true,
  "accepted": 2,
  "duplicates": 1,
  "results": [
    { "hash": "…", "status": "accepted" },
    { "hash": "…", "status": "duplicate" },
    { "hash": "…", "status": "rejected", "reason": "binary too large …" }
  ]
}
```

- **Auth:** `401` on a missing/invalid/revoked token.
- **No brain connected:** `409` — the client keeps everything queued and retries.
- **Per-item `status`:** `accepted` / `duplicate` / `rejected` → the client marks the item synced;
  `error` (transient) → the client keeps it queued and retries.
- **Idempotency:** durable per-`(owner, hash)` claim (`pa_pocket_capture_mac_sync_log`) — a re-sent
  item is reported `duplicate`, never written twice.
- **Binary size:** the client caps inline binaries at ~3 MB (base64 stays under Vercel's ~4.5 MB body
  limit); the server rejects anything over 4 MB. Larger screenshots are skipped client-side and
  logged (v1.1: direct signed-URL upload for large binaries).

## What's intentionally NOT in v0.1

Recall UI in the menu bar · OCR on screenshots · voice-memo capture (Whisper) · AI auto-tagging on
capture (tagging happens server-side) · auto-updates.

## Logs

`~/Library/Logs/Pocket Agent Capture/main.log` (electron-log). The app never uses `console.log`.
