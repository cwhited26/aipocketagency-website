# Launch to-dos

Items that need Chase's hands or a spend decision before a shipped lane is fully live. Each entry
names the lane that filed it and what unblocks it. Delete entries as they're cleared.

## Competitor Inspector / URL extraction worker (recon Lane C, 2026-06-12)

1. **Apply migration `supabase/migrations/078_url_extractions.sql`** to `haizcnyywvewjygzeaaf`
   (Supabase MCP needs interactive OAuth, not connected in the lane).
2. **Verify headless Chromium on Vercel production.** The worker runs playwright-core 1.52.0
   driving @sparticuz/chromium 133.0.0 (the Linux build traced into the capture route's bundle via
   `outputFileTracingIncludes`). The full pass is verified locally against a real Chrome — the
   sparticuz combination on Vercel's runtime is wired per its documented Playwright usage but not
   yet exercised in production. First check after deploy: run one capture from
   `/app/apps/competitor-inspector` and read the run row + extraction log.
3. **Browserbase is the fallback, not yet bought.** If the sparticuz launch fights Vercel's runtime
   (binary fails to unpack, protocol mismatch, memory ceiling), the decision per the recon brief is
   a managed browser vendor — Browserbase, ~$0.10+/browser-hour, needs an account + API key + a
   swap inside `src/lib/url-extraction/browser.ts` (one function — the rest of the worker doesn't
   change). Not spending until you call it.

No new required env vars. Optional: `PA_CHROMIUM_EXECUTABLE` to point local dev at a specific
Chrome/Chromium binary.

## PWA iOS splash screens (PWA lane, 2026-06-17)

The manifest + icons + safe-area insets are live. The one remaining polish item is Apple-specific
startup images — the white flash you see for ~200ms before the app shell paints when launched
from the home screen. Each iPhone screen size needs its own `apple-touch-startup-image` link.

**If you want to complete this:**
1. Generate splash PNGs at the common sizes (background `#05070a`, centered brand mark):
   - 430×932 (iPhone 15 Pro Max)
   - 393×852 (iPhone 15 Pro)  
   - 390×844 (iPhone 14 / 13)
   - 375×812 (iPhone 13 mini / X)
   - 375×667 (iPhone SE)
   Scale by 3× for actual image dimensions; use `public/icons/` as the output dir.
2. Add `<link rel="apple-touch-startup-image">` entries to `src/app/layout.tsx` using
   Next.js's metadata `icons` array or a custom `<head>` block.
3. Spec: https://developer.apple.com/design/human-interface-guidelines/launching#iOS-iPadOS

`background_color: #05070a` in the manifest already suppresses the white flash on Android.
iOS truly needs the startup images for the equivalent treatment.
