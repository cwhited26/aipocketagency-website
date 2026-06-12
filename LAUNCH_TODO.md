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
