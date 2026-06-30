---
name: tool-firecrawl-scraper
title: "Scrape a URL to Clean Markdown (Firecrawl)"
description: "Pull a web page into clean markdown via the Firecrawl API so it can be filed in the brain — with a graceful fallback when the key isn't set."
when_to_use: "When the owner drops a URL they want captured into the brain as readable text — a competitor page, an article, a doc. Use when you need the page's content, not a live screenshot."
tier_required: pro_plus
category: tool
license: Proprietary
agentskills_io_compatible: true
metadata:
  source: "Pocket Agent Starter Pack"
  tier_required: "pro_plus"
  category: "tool"
prerequisites: []
---

# Scrape a URL to Clean Markdown (Firecrawl)

Firecrawl turns a messy web page into clean markdown the brain can ingest. Call it with the URL, get back the main content stripped of nav and ads, and file that. If the FIRECRAWL_API_KEY isn't set, don't fail loudly — tell the owner the scraper isn't configured and offer the manual paste path.

## The technique

- Check for FIRECRAWL_API_KEY before anything. No key → return a graceful 503-style notice ("web scraping isn't set up yet") and offer to ingest a pasted copy instead. Never throw a stack trace at the owner.
- POST the target URL to the Firecrawl scrape endpoint with the API key in the Authorization header — a direct REST call, no SDK.
- Ask for markdown output and the main content only, so the result is readable, not a dump of menus and footers.
- Verify before filing: if the response is empty or an error, say so and stop — don't write a blank or an error page into the brain.
- File the cleaned markdown into the brain with the source URL and the date pulled, so the capture is traceable later.

## Do this, not that

**Do:** Owner drops a competitor's pricing page → confirm the key is set, scrape to markdown, check it actually has the pricing text, then file it under research with the URL and today's date.

**Don't:** Call the API with no key and let it throw a 401 the owner sees as a crash — or scrape a page that returned an empty body and file the blank into the brain as if it were content.

## Why this works

A clean-markdown capture is worth far more to the brain than a raw HTML dump full of navigation and tracking junk — it's readable, searchable, and quotable. Checking the key first and degrading gracefully is what keeps a missing setup from looking like a broken product: the owner gets a clear "not configured yet" and a way forward, not a stack trace. Verifying the body before filing stops the brain from quietly filling with empty pages that look like real captures.
