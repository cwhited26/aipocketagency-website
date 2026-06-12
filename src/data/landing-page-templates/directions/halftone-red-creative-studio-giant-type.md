---
slug: halftone-red-creative-studio-giant-type
name: Halftone Studio — Red Field / Giant Bottom-Anchored Type
vibe: red, loud, giant-type, editorial, agency
industries: creative agencies, marketing studios, branding shops, design studios, web3 marketing, social media agencies, video production
source: motionsites.ai archive (catalog title "Creative Studio — Agency", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
Full-viewport hero on a solid signal-red field (`#e02b10`) with a background video running underneath — the red and the footage blend into one saturated surface. The signature is the headline: "creative studio" in two lowercase lines, bottom-anchored, at `clamp(56px, 13vw, 155px)` with `line-height: 0.78` and `-0.04em` tracking — the two lines almost touch, reading as one typographic block. Next to it sits a huge white pill button ("begin now") with deliberately oversized padding (24px × 60px) that presses down on hover via `active:scale-95`.

The middle of the viewport carries two small text columns facing each other across the page: a left block with an uppercase wide-tracked kicker ("MARKETING COLLECTIVE" pattern) over a two-line positioning statement, and a right block with a small red logo mark, a product blurb, and a loose keyword list. Bottom-right, two frosted white stat cards (`rgba(255,255,255,0.92)` + 10px blur) hold big percentage numbers with quiet gray labels.

## Page layout
One section, three stacked rows inside a max-1100px middle band: navbar spacer, the facing text columns (side-by-side on desktop, stacked on mobile), then the bottom row with the giant headline + CTA on the left and the stat-card pair on the right. The nav is a row of small pill buttons — a solid white "HOME" pill, outlined siblings at `border-white/60` that sharpen to full white on hover — plus Instagram/send icon buttons and an outlined "Reservations" pill that inverts to white-on-red on hover. The wave-stroke logo renders white in the nav and red inside the content.

## Typography
- Display: Geist (Google Fonts) — weight 600 lowercase at up to 155px, `line-height: 0.78`, `-0.04em` tracking
- Body: Inter (300-700) — 13-14px supporting copy, uppercase kickers at `0.22em` tracking
- Stat numerals: Archivo Black (substitute for the prompt's Britanica-Black) at ~2.6rem on the white cards

## Color palette
- Field: signal red `#e02b10` (also the logo red and the hover text color on the inverting pill)
- Type: white everywhere on the red; near-black `#111` numerals on the stat cards
- Stat cards: white at 92% opacity with `backdrop-filter: blur(10px)`
- Gray `#888` stat labels — the only muted tone on the page

## Visual motifs
- **Bottom-anchored giant lowercase headline** (the signature) — viewport-scale two-line wordmark with crushed 0.78 line-height, pinned to the lower-left
- **Solid color field over video** — flat brand red as the base with footage breathing underneath
- **Oversized pill CTA** — white capsule with exaggerated 24×60px padding that compresses on press
- **Frosted stat cards** — two blurred white cards with display-weight numerals and small gray captions
- **Pill-row navigation** — small capsule buttons, one solid as the active page, others hairline-outlined
- **Facing text columns** — two narrow max-260px copy blocks across the middle of the viewport, like margin notes
- **Inverting outline button** — outlined pill that flips to white fill with red text on hover

## When to use
- Creative agencies and studios that want one unforgettable color and one unforgettable word
- Branding and design shops whose own brand IS the portfolio piece
- Marketing collectives pitching bold clients — the page demonstrates the appetite
- Social or video agencies with energetic reel footage to run under the red
- Brands launching with a single-page presence that needs to feel bigger than it is

## When to NOT use
- Conservative B2B or professional services — the red field reads aggressive on purpose
- Brands whose identity color isn't strong enough to carry a full viewport (the field IS the identity)
- Content-heavy sites — this is a one-screen statement, not an information architecture
- Anyone needing product UI or proof above the fold; see `lumetra-analytics-dark-parallax` for a product-led alternative
- Accessibility-strict audiences — white-on-saturated-red needs careful contrast checking at small sizes

## Build complexity
LOW. No animation framework and no scroll JS — hover transitions and a looping video are the only motion. The work is typographic tuning of the clamp scale across breakpoints.

## Library cross-references
- Motif: `bottom-anchored-giant-lowercase-headline`
- Motif: `solid-color-field-over-video`
- Motif: `oversized-pill-cta`
- Motif: `frosted-stat-cards`
- Motif: `pill-row-navigation`
- Typography: `geist-crushed-leading-inter-support`
- Color palette: `signal-red-white-frosted`
