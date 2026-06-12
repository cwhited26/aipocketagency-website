---
slug: nexel-black-floating-video-hero
name: Nexel — Black Hero with Floating Video Band
vibe: dark, minimal, enterprise, glassy, centered
industries: devtools, ai platforms, enterprise saas, testing and deployment tools, data infrastructure, security software, b2b software, api products
source: motionsites.ai archive (catalog title "Synapse Dark Hero", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A pure-black (`#000000`) hero where the background video does NOT fill the screen — it renders as a FLOATING BAND, 80vh tall, absolutely positioned `bottom-[35vh]`, sitting behind the centered text but lifted off the bottom edge. At 100% opacity with no overlay, the band reads like a wide cinematic pane hovering in a void rather than wallpaper. The stream arrives over HLS (an `.m3u8` source through hls.js in a memoized player component, falling back to native playback on Safari), swapped to `/placeholder-hero.mp4` in our builds.

Centered content stacks over it: a row of three glass "Integrated with" badges, a large headline around 80px with tight tracking ("Where Innovation Meets Execution" register), a two-line product description, and two buttons — a solid black pill with a white border, and a transparent glass pill. Everything staggers in with fade-up animations on load.

## Page layout
One viewport. Fixed top navbar on a blurred glass strip: text wordmark left (medium weight, tight tracking), links center — including one with a gradient-border active state and one styled with a strikethrough, a small wink that the team edits its own nav — and a white-to-gray gradient "Get Started for Free" button right. At the bottom of the viewport, a static row of grayscale partner logos at 40% opacity. No scroll sections.

## Typography
- Display + body: Inter (the prompt names no family — tight-tracked medium weights carry the look)
- Headline ~80px desktop, tracking tight; subtext two lines, muted
- Nav and badges at small sizes with glass surfaces doing the differentiation

## Color palette
- Background: pure black `#000000`
- Text: white, muted grays for subtext and logos
- Primary CTA: solid black `#000000` pill with a 1px white border
- Secondary CTA and badges: transparent glass with `backdrop-blur`
- Nav CTA: white-to-gray gradient pill

## Visual motifs
- **Floating video band** (the signature) — the background video is an 80vh pane raised 35vh off the bottom, hovering in black space behind the text instead of filling the screen
- **Glass integration badges** — a row of three small blurred-glass chips above the headline naming what the product plugs into
- **Black-on-black primary button** — a black pill separated from the black page only by its white border; quiet confidence as a CTA style
- **Strikethrough nav item** — one navigation link rendered struck-through, an intentional editorial mark
- **Gradient-border active state** — the current nav item carries a gradient border instead of a color change
- **Dimmed logo strip** — partner logos in grayscale at 40% opacity pinned to the viewport bottom
- **Staggered load-in** — badges, headline, subtext, and buttons fade up in sequence on first paint

## When to use
- Developer tools, AI platforms, and infrastructure products courting enterprise buyers
- Products with strong abstract or product-render footage that benefits from a framed pane rather than full-bleed
- Brands that want a dark hero quieter than the usual full-screen video
- Integration-led positioning — the badge row leads with the ecosystem
- Single-CTA launches and waitlists

## When to NOT use
- Brands without good footage; the floating band is the centerpiece and a weak clip is framed like art
- Warm or consumer-facing products — pure black with glass reads strictly B2B tech
- Pages that must explain features below the fold; this is a one-viewport statement
- Anyone whose video must show edge-to-edge — use `targo-logistics-dark-red-clipped` for full-bleed confidence

## Build complexity
LOW — static layout plus an HLS player component and stagger animations; the only nonstandard piece is the video positioning math.

## Library cross-references
- Motif: `floating-video-band`
- Motif: `glass-integration-badges`
- Motif: `black-on-black-bordered-cta`
- Motif: `strikethrough-nav-item`
- Motif: `dimmed-logo-strip`
- Typography: `inter-tight-medium-dark`
- Color palette: `pure-black-white-glass`
