# Install the Pocket Capture Shortcut

Capture anything by voice — "Hey Siri, Pocket Capture" — then just talk. Works on your
iPhone, iPad, and Apple Watch. Two ways to set it up: install the ready-made Shortcut (30
seconds), or have iOS build it for you.

---

## Before you start: get your token

1. Open **Pocket Agent** → **Captures → Settings**.
2. Tap **Create API token**. Give it a name like "iPhone".
3. **Copy the token now** — it starts with `pca_` and is shown only once. If you lose it,
   just create another and revoke the old one.

Keep that token handy; you'll paste it during install.

---

## Option A — Install the ready-made Shortcut (recommended)

1. On your iPhone, open this link:
   **ICLOUD_GALLERY_URL_PLACEHOLDER**
   *(Chase publishes the real iCloud Shortcuts Gallery link here once.)*
2. Tap **Get Shortcut** / **Add Shortcut**.
3. When prompted **"Paste your Pocket Capture token"**, paste the `pca_…` token you copied.
4. Done. Try it: say **"Hey Siri, Pocket Capture"**, then speak. You'll see a
   **"Saved to your brain"** notification.

### Make it even faster (optional)

- **Action Button** (iPhone 15 Pro and later): Settings → Action Button → choose Shortcut →
  **Pocket Capture**. Now a single press starts capture.
- **Apple Watch**: the same Shortcut appears in the Shortcuts app on your watch — raise your
  wrist, tap it, and dictate. Apple Watch Ultra's Action Button can be assigned to it too.
- **Back Tap**: Settings → Accessibility → Touch → Back Tap → Double Tap → Pocket Capture.

---

## Option B — Have iOS 19 build it for you

iOS 19's natural-language Shortcuts builder can wire the whole thing up. Open the
**Shortcuts** app, tap **+**, then **Describe a Shortcut**, and say (or paste):

> "When I run it, ask me what to save, then send the text to
> `https://aipocketagent.com/api/capture/shortcut` as a POST request with a JSON body where
> `text` is what I said, and add a header `Authorization` set to `Bearer ` followed by my
> Pocket Capture token. Then show me a notification that says Saved."

When it asks for the token, paste your `pca_…` token. Name the shortcut **Pocket Capture**
so "Hey Siri, Pocket Capture" triggers it.

---

## Troubleshooting

- **"Invalid or revoked token"** — the token was revoked or mistyped. Create a fresh one in
  Captures → Settings and re-paste it into the Shortcut (edit the Shortcut → the Text /
  token action).
- **"Connect your brain"** — finish Pocket Agent setup (connect your brain repo) first, then
  capture again.
- **Nothing happens after dictation** — check the URL in the Shortcut is exactly
  `https://aipocketagent.com/api/capture/shortcut` and that the `Authorization` header reads
  `Bearer pca_…` (with a space after `Bearer`).

---

## Privacy

Your token is the only secret. It's stored on Apple's side inside the Shortcut and as a
one-way hash on our side — we can never read it back. Lost your phone? Revoke that token in
Captures → Settings; the Shortcut stops working immediately and nothing else is touched.
