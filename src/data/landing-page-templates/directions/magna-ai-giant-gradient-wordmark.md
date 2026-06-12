---
slug: magna-ai-giant-gradient-wordmark
name: Magna AI — Giant Gradient Wordmark Hero
vibe: dark, monumental, gradient-accent, confident, product-led
industries: ai platforms, hr tech, talent acquisition saas, recruiting software, enterprise saas, data platforms, automation tools, b2b software
source: motionsites.ai archive (catalog title "Power AI — Hero Section", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
One move carries this hero: the product name set at 220px. "Magna AI" fills the center of a deep blue-purple-black viewport in a clean grotesque at font-normal, line-height 1.02, `-0.024em` tracking — and the "AI" is a gradient clip (`linear-gradient(to left, #6366f1, #a855f7, #fcd34d)`, indigo through purple to amber) on otherwise plain off-white text. Below, a small subtitle ("The most powerful AI ever deployed / in talent acquisition") and one rounded "Schedule a Consult" button. The wordmark IS the layout.

Behind it, a background video with a custom JS fade loop: the video starts at opacity 0, fades in over 0.5s, fades out over the last 0.5s of each pass via requestAnimationFrame, resets, waits 100ms, and replays — so the loop never hard-cuts. There is no gradient overlay on the video; instead a huge blurred dark shape (984×527px, `blur(82px)`, near-black at 90% opacity) sits centered behind the content, carving legibility out of the footage like a soft vignette.

## Page layout
Single hero viewport as a flex column: navbar on top, wordmark block centered by flex-1, logo marquee pinned to the bottom. The navbar is logo left, four text items center (two with chevron dropdowns), a rounded Sign Up button right, and — the fine detail — a 1px divider line under it that fades from transparent through 20% white and back. The bottom marquee pairs a static caption ("Relied on by brands / across the globe" at 50% white) with an infinite 20s scroll of client logos, each rendered as a frosted liquid-glass rounded tile holding the brand's first letter plus its name.

## Typography
- Display: Hanken Grotesk (substitute for the prompt's Fontshare General Sans, 400-700) — the 220px wordmark, font-normal
- Body: Geist (Google Fonts) — nav, subtitle, buttons; subtitle at text-lg, leading-8, 80% opacity

## Color palette
- Background: deep blue-purple near-black `#05010e` (hsl 260 87% 3%)
- Text: off-white `#f3f2ef` (40 6% 95%); hero subtext slightly dimmer at 82% lightness
- Gradient accent: indigo `#6366f1` → purple `#a855f7` → amber `#fcd34d`, applied only to the two letters "AI"
- Blur shield: gray-950 at 90% opacity, 82px blur

## Visual motifs
- **220px product wordmark** — the brand name as the entire hero composition, with a tri-color gradient clipped onto its key word
- **Soft-loop background video** — JS-driven opacity fades on every loop pass so the video never visibly restarts
- **Blurred shield instead of overlay** — one giant blurred dark rectangle behind the content keeps text readable while the video edges stay vivid
- **Glass letter-tile logo marquee** — client logos as frosted rounded tiles with initials, scrolling endlessly behind a static caption
- **Hairline gradient divider** — a 1px transparent-to-white-to-transparent rule under the navbar
- **Single-consult CTA** — one generously padded button; no competing actions

## When to use
- AI and SaaS products with a short, strong name (two words or fewer at 220px)
- HR tech, recruiting, and talent platforms — the source design's home turf
- Category-claiming launches where the brand name should do the talking
- Products selling via a booked consult rather than self-serve signup
- Teams that want a premium dark hero with exactly one custom-code trick

## When to NOT use
- Long brand names — the 220px treatment collapses past about 8 characters
- Brands that need explanation before impact; this page asserts, it doesn't argue
- Light-brand companies — the deep blue-black canvas is load-bearing
- Local services and trades (use `trades-phone-first-emergency`)

## Build complexity
MEDIUM complexity. Layout is simple, but the JS video fade loop, gradient text clip at huge scale, and gap-free marquee loop each need care; type must be re-clamped responsively from 220px down.

## Library cross-references
- Motif: `giant-product-wordmark-hero`
- Motif: `gradient-clip-keyword`
- Motif: `soft-loop-video-fade`
- Motif: `blurred-shield-legibility`
- Motif: `glass-letter-tile-marquee`
- Motif: `hairline-gradient-divider`
- Typography: `hanken-grotesk-geist-monumental`
- Color palette: `deep-violet-black-tricolor-gradient`
