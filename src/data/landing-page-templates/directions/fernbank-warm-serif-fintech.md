---
slug: fernbank-warm-serif-fintech
name: Fernbank — Warm Serif Fintech / Evergreen + Cream
vibe: warm, trustworthy, serif-led, organic, premium-calm
industries: fintech, banking apps, personal finance, wealth management, accounting software, financial advisors, credit unions, budgeting tools
source: motionsites.ai archive (catalog title "Evergreen Finance", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A fintech hero that reads warm instead of cold-blue. Full-viewport hero over a BOOMERANG video background (`/placeholder-hero.mp4` — soft nature or lifestyle footage suits the palette): the video plays through once while every frame is captured to offscreen canvases, then playback swaps to a canvas running the frames forward-and-reverse at 30fps — a perfect back-and-forth loop with no cut. The canvas layer sits at `scale(1.08)` so edges never show during playback.

Centered content: a Cooper-style soft serif heading at 2.2rem mobile up to 7xl desktop ("Own your money and build the wealth you deserve"), a short stone-toned subtext, then two CTAs — a frosted white "Watch 30s Demo" with play icon and a dark evergreen "Get the App". Every element enters with a fade-up-plus-deblur (opacity 0, y 24, 8px blur → sharp) staggered 0.1-0.4s. At the hero's bottom edge sit three white/95 frosted dashboard cards (Savings line chart with +25% badge, category bar chart with one orange bar, Bill Pay bar chart with one dark bar) — product proof without a screenshot, outer two hidden on mobile.

## Page layout
Three sections. Hero locks to viewport. Below, the page shifts to warm cream `#FDF5EB`: a testimonial section on a `3fr 2fr` grid (serif pull-quote, company badge, attribution, "All Stories" button left; a square looping video right), then a features section — heading row plus a four-card `aspect-[3/4]` grid. Three cards are photo-backed with a dark-green gradient rising from the bottom and a Lucide icon label on top; the third card breaks pattern as a solid beige stat card holding an SVG donut chart ("Monthly Spend", 50% of budget, four earth-tone arcs). All lower sections animate on scroll with the same fade-up-deblur. Cards stack 1/2/4 across breakpoints; everything uses `rounded-xl`/`rounded-2xl`, never full pills.

## Typography
- Display: Fraunces (substitute for the prompt's Cooper BT Light/Medium) — soft, rounded serif at weights 300-500; headings, wordmark, and pull-quotes
- Body: Inter (the prompt rides the default sans stack) — stone-600/700/800 grays for all paragraph and UI text
- Quote text also set in the serif at 18-24px for editorial warmth

## Color palette
- Primary dark evergreen: `#08150C`, hover `#1a2e1f`
- Warm cream section background: `#FDF5EB`
- Beige cards: `#EBE4DC` outer, `#F4F1EC` inner
- Donut chart earth tones: `#C46B2D`, `#7A8C3E`, `#A8B87A`, `#B8AFA4`
- Single orange chart accent: `#f97316`; greens via emerald-400/500 badges
- No purple or indigo anywhere

## Visual motifs
- **Boomerang video loop** (the signature) — frames captured to canvas during one playthrough, then ping-ponged forward/reverse at 30fps; the background breathes instead of looping with a cut
- **Fade-up with blur clear** — every reveal animates `opacity 0, y 24px, blur 8px` to sharp over 0.7s; scroll-triggered below the hero, immediate in it
- **Frosted dashboard trio** — three white/95 mini finance cards (line chart, bar charts, percentage stats) anchored to the hero's bottom edge
- **Dark-green gradient photo cards** — 3:4 feature cards with imagery under a `#08150C` gradient and an icon-plus-label header
- **Donut stat card** — one card in the grid swaps photo for a beige panel with an SVG donut in four earth tones and a centered "50% of budget"
- **Serif pull-quote testimonial** — a long serif quote with a small dark company badge and plain attribution, beside a square looping video
- **Evergreen buttons, squared corners** — all CTAs in `#08150C` with `rounded-xl`, never full pills

## When to use
- Personal finance, banking, and budgeting apps that want to feel human, not corporate
- Wealth management and advisory brands targeting calm confidence
- Fintech products differentiating against blue-gradient SaaS sameness
- Sustainability-adjacent finance (green investing, ethical banking) — the palette does the positioning
- Any money product where trust and warmth beat tech flash

## When to NOT use
- Crypto or trading platforms that want speed and dark-mode energy
- Brands locked to blue or monochrome identities — the evergreen-and-cream pairing is the whole point
- Teams without three believable mini-chart datasets; empty dashboard cards read as fake
- Local service businesses (use `contractor-photo-first-trust`)

## Build complexity
MEDIUM. The page itself is standard sections, but the boomerang capture component (frame grabbing, canvas playback, the video-to-canvas swap) is the one genuinely tricky piece — a plain looped video is the honest fallback if scope is tight.

## Library cross-references
- Motif: `boomerang-canvas-video-loop`
- Motif: `fade-up-blur-clear-reveal`
- Motif: `frosted-dashboard-card-trio`
- Motif: `gradient-photo-feature-cards`
- Motif: `donut-stat-card`
- Motif: `serif-pull-quote-testimonial`
- Typography: `fraunces-soft-serif-stone-body`
- Color palette: `evergreen-cream-earth-tones`
