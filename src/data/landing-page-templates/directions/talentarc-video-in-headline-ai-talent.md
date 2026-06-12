---
slug: talentarc-video-in-headline-ai-talent
name: TalentArc — Video-in-Headline AI Talent Hero
vibe: dark, engineered, metallic, human-plus-ai, confident
industries: hr tech, talent platforms, workforce analytics, recruiting software, learning and development, ai consultancies, enterprise saas, staffing agencies
source: motionsites.ai archive (catalog title "Grow AI Talent Platform", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Full-screen black hero with a streaming video background (`/placeholder-hero.mp4`, HLS via hls.js, full opacity, no overlay) and content pushed well down the viewport (~380px from top) so the footage breathes above the headline. The headline is the signature: three lines at `clamp(2.2rem, 7vw, 6.5rem)`, weight 300. The first two lines ("The vision" / "of engineering") render in a metallic gradient — `linear-gradient(90deg, #666666, #d0d0d0 50%, #666666)` clipped to the text — so they read like brushed steel. The third line mixes words with two CIRCULAR INLINE VIDEO CHIPS sitting in the text flow: "is [video chip] human + [video chip] AI", where each chip is a rounded-full looping clip (~110px desktop, clamped to 48px minimum) — one showing a person, one showing machine imagery. Connector words ("is", "+") drop to `#999`.

Below: a one-sentence subhead in `#ccc`, then a black CTA button with a green glow — `box-shadow: 0px 6px 24px 6px rgba(39,243,169,0.15)`, a thin `#30463C` outline, glow brightening and button scaling to 1.03 on hover, 0.98 on press.

## Page layout
One viewport, centered column, max-width ~5xl. Headline dominates; subhead is capped at ~xl width; single CTA. The whole pitch is the headline sentence — the video chips ARE the value prop (human + AI, side by side, alive).

## Typography
- Display: Manrope weight 300 (substitute for the prompt's YDYoonche L/M) — large, light, tight `-0.01em` tracking, line-height 1.1
- Body: same face at weight 400 for subhead and button text
- Metallic gradient text on the first two headline lines via background-clip

## Color palette
- Background: pure black `#000000`
- Metallic headline gradient: `#666666` → `#d0d0d0` → `#666666`
- Connector words and subhead: `#999999` / `#cccccc`
- CTA glow: green `rgba(39,243,169,0.15)` resting, `0.22` on hover; outline `#30463C`
- Headline white words: `#ffffff`

## Visual motifs
- **Video chips inside the headline** (the signature) — two circular looping videos sit inline in the sentence like words, one human, one machine
- **Brushed-metal gradient text** — horizontal gray-silver-gray gradient clipped to the display lines
- **Green-glow CTA on black** — dark button lit from beneath by a soft green shadow that brightens on hover
- **Full-bleed streaming video, no overlay** — HLS background at 100% opacity carries the atmosphere
- **Muted connector words** — small grammatical words drop to gray so the key nouns carry the line

## When to use
- Talent platforms, workforce analytics, and HR tech selling a human-plus-AI story
- AI consultancies and automation firms that want "people and machines together" said visually
- Enterprise SaaS launches where one sentence is the whole pitch
- Recruiting and staffing brands moving upmarket from job-board aesthetics
- Any brand with two short, contrasting video clips that can carry meaning at coin size

## When to NOT use
- Brands without the two inline clips — with static images the headline loses its reason to exist
- Local services and trades; the dark engineered tone reads wrong (use `contractor-photo-first-trust`)
- Content-heavy pitches that need features and pricing up front (use `bookedup-deep-shadow-saas`)
- Warm consumer wellness brands — brushed steel is the opposite of soft

## Build complexity
MEDIUM complexity. Three synchronized videos (one HLS stream plus two MP4 chips), gradient-clipped text, and careful inline-flex headline wrapping across breakpoints.

## Library cross-references
- Motif: `inline-circular-video-chips-in-headline`
- Motif: `metallic-gradient-clipped-text`
- Motif: `green-glow-cta-on-black`
- Motif: `full-bleed-video-no-overlay`
- Typography: `light-weight-oversize-sans`
- Color palette: `black-steel-gradient-neon-green`
