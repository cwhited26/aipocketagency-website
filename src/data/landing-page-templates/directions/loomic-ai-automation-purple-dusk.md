---
slug: loomic-ai-automation-purple-dusk
name: Loomic — AI Automation Dark Purple Hero
vibe: dark, calm, premium, ai-coded, soft-motion
industries: ai agencies, automation consultants, b2b saas, marketing automation, it services, data analytics, software consultancies, workflow tooling
source: motionsites.ai archive (catalog title "AI Automation Hero", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Full-viewport hero on a near-black purple base `#070612`. The background video sits behind everything but is pushed 200px to the right and scaled 1.2x from its left edge — the visual interest lives on the right half of the screen while the left half stays dark and readable with NO overlay. A bottom fade gradient (about 160px tall) blends the video into the background color so the hero never hard-cuts.

Content is left-aligned and vertically centered inside a max-w-7xl container. Top to bottom: a pill badge (thin white border at 20% opacity, backdrop blur, a small sparkle icon, short product-announcement text), then a three-line headline where the final word renders in serif italic against the otherwise sans headline, then a one-sentence subtitle at 80% white, then two CTAs — a solid white pill with a right-arrow icon and a frosted `bg-white/20` pill behind it.

The motion is the mood: every element enters with a blur-in (opacity 0→1, blur 10px→0, y 20→0 over 0.6s), and the headline runs a word-by-word split-text stagger (0.08s between words, each word rising 40px). Delays cascade badge → headline → subtitle (0.4s) → buttons (0.6s), so the hero assembles itself in about 1.5 seconds.

## Page layout
Single full-screen hero, no scroll. Three z-layers: video (z-0), bottom gradient (z-10), content (z-20). Headline scales text-4xl → text-6xl across breakpoints; subtitle capped at max-w-xl. Vertical rhythm is a 6-unit gap between badge/headline/subtitle and a 12-unit gap before the buttons. Works on mobile because the content column is left-anchored and the video offset just shows less of itself.

## Typography
- Display: Inter (the prompt names no face — a medium-weight geometric sans at font-medium, leading-tight) with the final headline word in Instrument Serif italic for contrast
- Body: same sans at text-lg, leading-relaxed, 80% white

## Color palette
- Background: `#070612` (dark purple-black)
- Headline + primary CTA fill: white `#ffffff`
- Body and badge text: white at 80% opacity
- Secondary CTA: `rgba(255,255,255,0.2)` with backdrop blur
- Bottom fade: gradient from `#070612` to transparent over the video

## Visual motifs
- **Right-shifted background video** — the video is offset 200px right and scaled 1.2x with origin-left, so the dark left half carries the text with no overlay needed
- **Blur-in entrances** — every element arrives by sharpening from a 10px blur while rising 20px, not by fading alone
- **Word-stagger headline** — split-text animation, each word rising 40px with 0.08s between words
- **Serif-italic last word** — one word of the sans headline flips to serif italic, the cheapest possible signal of taste
- **Glass announcement badge** — pill with sparkle icon, thin 20% white border, backdrop blur, used for a product news one-liner
- **Bottom fade into background** — a 160px gradient that dissolves the video into the page color instead of a hard frame edge

## When to use
- AI agencies and automation consultants selling to businesses
- B2B SaaS that wants a calm, premium first screen instead of a feature grid
- Service firms whose pitch fits in one headline and one booked call
- Any offer where "book a free call" is the single conversion
- Brands that want motion polish without a complex page

## When to NOT use
- Local trades and emergency services — too quiet, no phone number up front (use `trades-phone-first-emergency`)
- Brands without a usable atmospheric video — the right-shifted video IS the design
- Content-heavy launches that need sections below the fold; this is a one-screen statement
- Light-brand companies — the dark purple base is load-bearing

## Build complexity
LOW. One screen, two reusable animation components (blur-in and split-text), no scroll logic. A Tier 1 build ships it in hours.

## Library cross-references
- Motif: `right-shifted-background-video`
- Motif: `blur-in-entrance`
- Motif: `word-stagger-split-headline`
- Motif: `serif-italic-accent-word`
- Motif: `glass-announcement-badge`
- Typography: `sans-medium-serif-italic-accent`
- Color palette: `purple-black-white-frosted`
