# Pocket Capture — iOS Shortcut (PC-CORE-4)

The Voice Shortcut is the hands-free, eyes-free capture surface. The user says
**"Hey Siri, Pocket Capture"**, dictates a thought, and the Shortcut POSTs the dictated
text to Pocket Capture with their personal API token. Works on iPhone, iPad, and Apple
Watch (wrist-up dictation), and can be bound to the iPhone 15+ / Apple Watch Ultra
Action Button.

This directory holds everything needed to **publish** the Shortcut and **install** it:

| File | Audience | Purpose |
|---|---|---|
| `README.md` (this file) | Chase / maintainers | What the Shortcut does + how to author & publish it to the iCloud Shortcuts Gallery |
| `INSTALL.md` | End users | Step-by-step install + token setup, plus the "tell iOS 19 to build it for you" path |
| `pocket-capture.shortcut` | — | Placeholder. The real signed `.shortcut` binary is published from a Mac/iPhone once (see "Publishing", below). Cannot be authored from this repo. |

---

## What the Shortcut does

1. **Receive / dictate text** — if the Shortcut was run from a Share Sheet it uses the
   shared text; otherwise it runs **Dictate Text** so the user can speak.
2. **Get Contents of URL** — `POST https://aipocketagent.com/api/capture/shortcut`
   - Header: `Authorization: Bearer <the user's pca_… token>`
   - Header: `Content-Type: application/json`
   - Request Body (JSON):
     ```json
     { "text": "<dictated text>", "source_hint": "siri" }
     ```
3. **Show Notification** — a silent visual confirmation ("Saved to your brain.") per
   PC-Q3 (visual notification only, no spoken confirmation).

The endpoint authenticates the token, dedups re-fires (identical text in a 5-second
window is a no-op), and writes the text into the user's Capture Inbox tagged
`source="voice_shortcut"`. It returns `{ "success": true, "capture_id": "…" }`.

> **The token is the only secret.** It is minted in Pocket Agent
> (`POST /api/app/pocket-capture/api-tokens`), shown to the user exactly once, and stored
> only as a SHA-256 hash server-side. If a phone is lost, the user revokes that token from
> the dashboard (`DELETE /api/app/pocket-capture/api-tokens/:id`) and the Shortcut stops
> working — no other tokens are affected.

---

## Authoring the Shortcut (one-time, by Chase)

Build it once in the **Shortcuts** app on iOS or macOS:

1. New Shortcut → name it **"Pocket Capture"** (this is the Siri trigger phrase — PC-Q6).
2. Add **Dictate Text** (set *Stop Listening* → *After Pause*).
3. Add **Text** → put the API token in for your own test run (users replace this on install
   via the import question — see below).
4. Add **Get Contents of URL**:
   - URL: `https://aipocketagent.com/api/capture/shortcut`
   - Method: `POST`
   - Headers: `Authorization` = `Bearer ` + the Text token; `Content-Type` = `application/json`
   - Request Body: `JSON` → `text` = *Dictated Text*, `source_hint` = `siri`
5. Add **Show Notification** → "Saved to your brain."
6. **Make the token an import question** so each installer is prompted for their own:
   Shortcut settings → *Import Questions* → add a question on the Text action:
   "Paste your Pocket Capture token (starts with pca_)".

### Publishing to the iCloud Shortcuts Gallery

1. In Shortcuts, right-click / long-press the **Pocket Capture** shortcut → **Share** →
   **Copy iCloud Link**. This produces a public URL like
   `https://www.icloud.com/shortcuts/<hash>`.
2. Drop that URL into the onboarding deep link + `INSTALL.md` (replace the
   `ICLOUD_GALLERY_URL_PLACEHOLDER` token in both places).
3. Commit the published `.shortcut` export over the placeholder file here so the repo has a
   reference copy: in Shortcuts → **File → Export** → save as `pocket-capture.shortcut`.

> ⚠️ A `.shortcut` file is a signed Apple property-list bundle. It **cannot be authored or
> signed from this repo** — it must be exported from the Shortcuts app on Apple hardware.
> The committed `pocket-capture.shortcut` here is a documented placeholder until Chase
> exports the real one.

---

## What Chase still needs to do

1. **Author + publish** the Shortcut (steps above) and grab the iCloud Gallery URL.
2. **Replace** `ICLOUD_GALLERY_URL_PLACEHOLDER` in `INSTALL.md` and in the onboarding
   deep-link config with that URL.
3. **Export** the real `pocket-capture.shortcut` over the placeholder and commit it.
4. Confirm the production host in the URL is correct — this doc assumes
   `https://aipocketagent.com`. If the capture API is served from a different host (e.g.
   `api.aipocketagent.com`), update both docs + the Shortcut.
