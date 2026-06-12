---
slug: operandi-automation-serif-dashboard
name: Operandi — Automation Serif Dashboard Hero
vibe: light, serif-led, fintech-clean, product-forward, single-screen
industries: automation saas, ai agents, fintech, b2b software, operations tooling, banking platforms, finance ops, productivity software
source: motionsites.ai archive (catalog title "Nexora Automation", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A no-scroll SaaS hero: navbar plus hero fill exactly 100vh with `overflow-hidden`, and the product dashboard deliberately runs off the bottom edge of the viewport — clipped mid-table, which makes the product feel bigger than the page. A muted fullscreen video sits behind the content at z-0; everything above it is light-theme and token-driven.

Centered column, top to bottom with staggered fade-ups (y 10-30px, delays 0 → 0.5s): a bordered pill badge announcing the latest model support, then the headline — Instrument Serif at text-5xl up to 5rem, line-height 0.95, with the key adjective swapped into italic ("The Future of *Smarter* Automation" pattern) — then a one-sentence subheadline in Inter, then a charcoal pill "Book a demo" next to a round white play button with a soft shadow. Below them the showpiece: a frosted glass wrapper (40% white fill, 50% white border, a wide soft `0 25px 80px` shadow) holding a fully hand-coded banking-style dashboard at 11px scale — top bar with search and ⌘K, a sidebar with badge counts, a greeting, pill action buttons, a balance card with a seven-figure balance and a smooth indigo Bézier area chart, an accounts card, and a four-row transactions table with amber/green status chips.

## Page layout
One viewport, flex column: slim navbar (logo with a ✦ glyph left, four quiet links and a rounded CTA right), then the centered hero stack. The dashboard container is max-w-5xl and intentionally overflows the bottom. Light mode only. All colors are HSL design tokens, never raw values in components — the direction re-skins cleanly by changing six variables.

## Typography
- Display: Instrument Serif (Google Fonts, with italic) — headline at 5xl-5rem, leading 0.95, one italic word as the emphasis device
- Body: Inter (Google Fonts, weights 400-600) — subheadline, buttons, and every dashboard label down to 10px

## Color palette
- Background: white `#ffffff`
- Foreground: dark charcoal `#252B31` (hsl 210 14% 17%) — text and primary buttons
- Accent: indigo `#6366F1` (hsl 239 84% 67%) — chart line, gradient fill, primary action chips
- Muted: 96% gray surfaces, 55% gray-cyan secondary text
- Dashboard glass: `rgba(255,255,255,0.4)` fill, `rgba(255,255,255,0.5)` border, shadow `0 25px 80px -12px rgba(0,0,0,0.08)`

## Visual motifs
- **Clipped dashboard** — the coded product UI overflows the bottom of the locked viewport, implying there's more product than page
- **Serif headline with italic pivot** — Instrument Serif display line where one word turns italic to carry the promise
- **Frosted dashboard frame** — a translucent white rounded-2xl wrapper that floats the dashboard above the background video
- **Hand-coded fintech UI** — sidebar, balance card, Bézier area chart, accounts list, and transactions table all built in React at 11px, so every label is brandable
- **Badge-headline-CTA cascade** — the classic centered SaaS stack, each element fading up 0.1s after the last
- **Play-button sidecar** — a round white shadowed play button beside the primary pill for a demo video

## When to use
- Automation and AI-agent SaaS selling to operations or finance teams
- Fintech and banking platforms — the dashboard is already money-shaped
- B2B software that wants a product-first hero without real screenshots
- Early-stage products: the coded dashboard stands in for a mature UI before one exists
- Anyone running a "book a demo" motion as the single conversion

## When to NOT use
- Consumer apps — the ledger-and-balances dashboard reads enterprise
- Brands with an actual product UI that looks better than a mock; show the real thing instead
- Dark-brand SaaS (use `bookedup-deep-shadow-saas`)
- Content-led launches needing sections below the fold; the viewport is locked

## Build complexity
MEDIUM. The page itself is simple, but the dashboard mock (sidebar, chart, tables at 11px) is several hours of fiddly component work.

## Library cross-references
- Motif: `clipped-overflow-dashboard`
- Motif: `serif-italic-pivot-headline`
- Motif: `frosted-dashboard-frame`
- Motif: `hand-coded-dashboard-proof`
- Motif: `badge-headline-cta-cascade`
- Typography: `instrument-serif-inter-saas`
- Color palette: `white-charcoal-indigo-tokens`
