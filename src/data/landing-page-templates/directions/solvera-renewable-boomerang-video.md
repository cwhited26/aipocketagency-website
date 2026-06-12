---
slug: solvera-renewable-boomerang-video
name: Solvera Energy — Renewable / Boomerang Video Hero
vibe: light, clean, green, airy, motion-led
industries: solar, renewable energy, wind energy, energy services, climate tech, sustainability consultancies, ev charging, green building
source: motionsites.ai archive (catalog title "EcoVolta", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Full-screen light hero (`#F7F7F7`) for a renewable energy company, where the signature is a BOOMERANG VIDEO BACKGROUND that never shows a loop cut. A `<video>` plays through once while every frame is captured to offscreen canvases (via `requestVideoFrameCallback`, 60fps `setInterval` fallback, frames scaled to max 960px wide); when the video ends, it hides and a visible canvas plays the captured frames back at 30fps forward-then-reverse, repeating forever. The video layer is fixed and pushed 200px down from the top of the viewport, so the headline sits on clean light gray and the footage glows behind the lower half of the hero.

The headline itself ("Renewable Power For Tomorrow, Infinite Clean Solutions") animates in LETTER BY LETTER — each character is its own span fading in with a 0.03s-per-letter stagger — in a dark forest green `#31463B` at up to `text-6xl`. Above it, a hairline-bordered badge pill mixes emoji (sun, globe, plant) with arrows and a short tagline. Below, a subheading fades down, then two pill CTAs: a green gradient primary (`#3C684D → #4A7144`) with a leaf icon and a circular gradient disc holding a play icon, and a white secondary ending in a gray gradient disc with an arrow.

## Page layout
Single `h-screen` flex column: slim top nav (logo + globe language selector left, five links center, bordered "Sign In" pill + solid black pill right), then the centered hero stack. Nav links hide below `lg`, sign-in below `sm`, CTAs stack vertically below `sm`. A liquid-glass utility (1.4px masked-gradient border, 4px blur) is defined in the system for glass surfaces.

## Typography
- Display + body: Inter (Google Fonts, weights 300-900)
- Headline: up to `lg:text-6xl`, normal weight, leading-tight, dark green via inline color
- A `-0.06em` tight-tracking utility exists for display moments

## Color palette
- Page background: `#F7F7F7`
- Heading: `#31463B` (dark forest green)
- Primary CTA gradient: `#3C684D` → `#4A7144`; its icon disc: 59deg `#567A5E` → `#78A873`
- Secondary icon disc: 59deg `#EEEEEE` → `#CBCBCB`
- Body gray-600, nav gray-700, black solid nav button, `border-black/20` hairlines

## Visual motifs
- **Boomerang video loop** — frames captured to canvas during one playthrough, then played forward and reverse at 30fps forever; the loop has no visible restart
- **Letter-by-letter headline** — every character staggers in at 0.03s intervals, triggered once on scroll into view
- **Video tucked below the type** — the fixed video layer starts 200px down so the headline sits on flat light gray and the footage fills the lower hero
- **Emoji badge pill** — sun/globe/plant emoji with arrows inside a hairline rounded pill, shortened copy on mobile
- **Gradient disc CTA pair** — both pill buttons end in a small circular gradient disc holding an icon (play / arrow)
- **Glass border utility** — 1.4px white gradient border drawn with a mask-composite trick, blur(4px) surface

## When to use
- Solar, wind, and renewable energy companies with good aerial or installation footage
- Climate tech and sustainability brands that want light and optimistic, not dark and techy
- EV charging, green building, energy services — anything selling clean infrastructure
- Brands whose footage has an obvious "moment" worth replaying — the boomerang turns 6 seconds of video into an infinite ambient loop
- Companies that want a calm hero with one strong typographic entrance

## When to NOT use
- Anyone without decent video footage — the boomerang trick is the whole show
- Performance-strict builds — frame capture to canvas costs memory and CPU on low-end phones
- Dark-brand or heavy-industrial energy companies — this reads light and consumer-friendly; see `solar-energy-day-night-toggle` for a toggle-driven energy alternative
- Pages that need lots of content above the fold — the hero is type + footage, nothing else

## Build complexity
MEDIUM. The boomerang canvas component is custom JavaScript (frame capture, rAF playback, fallback path) and needs real-device testing; everything else is standard Tailwind + Framer Motion stagger work.

## Library cross-references
- Motif: `boomerang-canvas-video-loop`
- Motif: `letter-stagger-headline-reveal`
- Motif: `video-offset-below-headline`
- Motif: `gradient-disc-pill-cta`
- Motif: `emoji-badge-pill`
- Typography: `inter-single-family-green-display`
- Color palette: `light-gray-forest-green-gradient`
