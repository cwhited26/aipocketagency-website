---
slug: kinetra-bio-digital-white-minimal
name: Kinetra — Bio-Digital White Minimal
vibe: white, ultra-minimal, luxury-tech, quiet, pill-shaped
industries: biotech, robotics, medical devices, ai research labs, deep tech startups, prosthetics, health tech, premium b2b software
source: motionsites.ai archive (catalog title "Bio-Digital", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Single-screen, white-on-white luxury tech hero. A fullscreen looping video fills the viewport behind everything, entering with a slow fade and a settle from 1.05x scale over 1.8s. Centered on it: a two-line wordmark headline in Outfit at viewport-scaled sizes (7.5vw mobile down to 4.6vw desktop, line-height 0.9) — line one is the brand name in full black medium weight; line two is a tagline like "cybernetics made organic" where the first word sits at 25% black light weight and the rest snaps back to full black. That one opacity shift is the whole typographic trick.

The chrome is a family of pills. Top-left: a slanted dual-capsule SVG logo plus brand name, then a black pill "Menu" button containing a white circle with a plus icon, then a light-gray metadata pill carrying two quiet descriptors. Top-right: a gray compound pill with a black icon circle (a four-node clover mark) and a short systems label. Bottom: a footer that fades up from solid white over the video, holding a small label, one 21px statement sentence, a hairline vertical divider, and three outline tag pills that invert to black on hover. Everything enters on the same easing curve `[0.16, 1, 0.3, 1]` with staggered delays — nav drops in, headline rises, footer follows at 0.5s.

## Page layout
One viewport, flex column, content pinned to top (nav), center (headline), and bottom (footer). No scroll, no sections. The footer's white gradient (`from-white via-white/80 to-transparent`) is what keeps text legible over the video — there is no dark overlay anywhere. The whole design holds because the palette refuses color: black, white, two grays, nothing else.

## Typography
- Display: Outfit (Google Fonts, weights 300-700) — wordmark headline at vw scale, medium weight, tight tracking, line-height 0.9
- Body: Inter (Google Fonts, weights 400-600) — every UI label, all in the 11-21px range
- The faded-word device: one word at `text-black/25 font-light`, the rest `text-black font-medium`, inside the same line

## Color palette
- Background and footer fade: pure white `#ffffff`
- Text and primary pills: pure black `#000000`
- UI pill fill: `#F4F4F6` light gray, hover `#EAEAEF`
- Muted text: black at 25/50/60/70% opacities — opacity does all the hierarchy work
- Explicitly no purple, indigo, or violet anywhere

## Visual motifs
- **Faded-word headline** — one word of the tagline drops to 25% black and light weight, making the sentence read in two voices
- **Pill chrome everywhere** — menu button, metadata badges, and tags are all `rounded-full`; the page has no square UI
- **Circle-in-pill buttons** — a black pill holding a white icon circle (and the gray inverse of it), the recurring component
- **White footer fade** — a bottom gradient from transparent to solid white that floats the closing text over the video without darkening it
- **Slow video settle** — the background video fades in while easing down from 1.05x scale, an expensive-feeling first two seconds
- **Inverting tag pills** — outline pills that flip to solid black with white text on hover, with a small press-down scale
- **One easing curve** — every animation on the page shares `[0.16, 1, 0.3, 1]`, which is why the motion feels art-directed

## When to use
- Biotech, robotics, and prosthetics companies wanting a gallery-grade first impression
- AI research labs and deep tech startups pre-product
- Medical device brands with strong macro/lab video footage
- Premium B2B software that sells through credibility, not feature lists
- Any brand whose video is good enough to carry a page with under 40 words on it

## When to NOT use
- Anyone needing conversion elements above the fold — there is no CTA, form, or pricing
- Brands without a light, high-production video; a dark video breaks the white footer fade
- Content-rich launches; this is a statement screen, not a site
- Warm consumer brands — the clinical whiteness reads cold on purpose

## Build complexity
LOW. One screen, stock framer-motion fades, no scroll logic. The craft is restraint, not engineering.

## Library cross-references
- Motif: `faded-word-two-voice-headline`
- Motif: `pill-chrome-system`
- Motif: `circle-in-pill-button`
- Motif: `white-footer-fade-over-video`
- Motif: `slow-video-settle-entrance`
- Motif: `inverting-tag-pills`
- Typography: `outfit-inter-vw-minimal`
- Color palette: `white-black-gray-opacity-hierarchy`
