---
slug: stryde-athletic-spotlight-reveal
name: Stryde — Athletic Footwear Spotlight Reveal
vibe: dark, cinematic, interactive, premium-consumer, athletic
industries: footwear, athletic apparel, sporting goods, premium consumer products, fitness brands, streetwear, product launches, performance gear
source: motionsites.ai archive (catalog title "Nike Premium Landing", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Two full-viewport screens for a premium athletic footwear brand, both built on the same signature: a SPOTLIGHT REVEAL. A static product photo covers a looping product video, and six mouse-trailing circles cut a soft radial hole through the photo (an SVG mask with a radial gradient, each trailing circle smaller and fainter than the last, positions lerped toward the cursor at 0.2/0.35 factors per frame) — wherever the visitor moves, the photo dissolves and the video plays underneath. Hover zones start and pause the video so it only runs while the visitor is exploring.

Screen one is sticky behind screen two (screen two slides over it with a heavy top shadow, like a card laid on top). Screen one: a centered brand mark at the top, a round hamburger top-right, and a bottom-center headline at `clamp(14px, 3vw, 51px)` that alternates a medium sans with serif-italic phrases line by line. Screen two adds a stat module — a heavy-blur glass card (`backdrop-filter: blur(80px)` on a 16% black fill) holding a 72px serif-italic "78%" in the brand's orange-red plus a glowing SVG line graph — a bottom-left mixed-face headline at 44px, and a bottom-right stacked label block: a white bar with tiny uppercase serif type over a solid accent-color block carrying the brand mark.

The menu is its own act: the hamburger opens a fullscreen dimmed blur overlay of pill-shaped links, each rotated a few degrees off-axis, popping in with a springy back-out scale stagger; each pill straightens and recolors to its own hover color (red, blue, green, amber, violet).

## Page layout
Two 100dvh sections, dark throughout (`#050505` base). Section one is `sticky top-0 z-0`; section two is `relative z-10` with `box-shadow: 0 -20px 50px rgba(0,0,0,0.5)` so the scroll reads as one card sliding over another. All copy is positioned absolutely against the full-bleed media — there is no column grid. Desktop-first by nature; the spotlight is a cursor interaction.

## Typography
- Display: Manrope (Google Fonts, weights 400-700) — medium weight, tight tracking, used for the sans lines of every headline
- Body: Instrument Serif (Google Fonts, regular + italic) — the italic phrases woven into headlines, the giant stat number, and the small uppercase label bars

## Color palette
- Background: `#050505` near-black
- Text: white, with `white/64` for stat captions
- Accent: `#DA3A16` burnt orange-red — stat number, graph line + glow, logo block
- Glass stat card: `rgba(0, 0, 0, 0.16)` with `blur(80px)` and a 10% white border
- Menu pills: white fill, dark text, per-item hover colors (red/blue/green/amber/violet)

## Visual motifs
- **Spotlight reveal** (the signature) — a photo masked over a video; six trailing mouse-follow circles cut a soft-edged radial hole so the video shows only under the cursor, with the trail lagging like a flashlight beam
- **Hover-to-play video** — invisible hover zones start the hidden video and pause it on leave, so motion is a reward for exploring
- **Sticky section slide-over** — screen one pins, screen two slides up over it with a deep top shadow
- **Bubble pill menu** — fullscreen blur overlay of rotated pill links that spring in with a staggered back-out pop and straighten on hover
- **Serif-italic stat card** — heavy-blur glass card with a 72px italic percentage in the accent color and a glowing line-graph SVG beside it
- **Mixed-face headlines** — sans and serif-italic alternate by phrase inside a single heading, the premium-consumer tell
- **Stacked label block** — a thin white uppercase-serif bar sitting on a solid accent block with the brand mark, like a shoebox end label

## When to use
- Footwear, apparel, and sporting goods brands with strong product photography AND product video
- Premium consumer product launches where the page is the ad
- Fitness and performance brands selling identity, not specs
- Streetwear drops and limited collections
- Any brand that wants visitors to physically play with the page

## When to NOT use
- Service businesses and B2B — this sells objects, not engagements
- Anyone without matched photo + video pairs of the same scene; the reveal needs both
- Mobile-dominant traffic — the spotlight is a cursor interaction and degrades to a static image on touch
- Conversion-first landing pages; there is no form, no pricing, no CTA above the fold
- Tight budgets — the mask, trail math, and menu are custom work (consider `loomic-ai-automation-purple-dusk` for a cheaper dark hero)

## Build complexity
HIGH. The SVG mask trail, hover-zone video control, sticky slide-over, and GSAP pill menu are four separate custom systems. Quote as a top-tier build.

## Library cross-references
- Motif: `spotlight-reveal-photo-over-video`
- Motif: `mouse-trail-mask-circles`
- Motif: `hover-to-play-video-zones`
- Motif: `sticky-section-slide-over`
- Motif: `bubble-pill-overlay-menu`
- Motif: `serif-italic-stat-glass-card`
- Motif: `mixed-sans-serif-headline`
- Typography: `manrope-instrument-serif-athletic`
- Color palette: `near-black-burnt-orange-white`
