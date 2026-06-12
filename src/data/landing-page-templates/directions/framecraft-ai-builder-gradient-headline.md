---
slug: framecraft-ai-builder-gradient-headline
name: Framecraft — AI Builder / Serif Lead-In / Gradient Mega-Headline
vibe: dark, giant-type, gradient-glow, serif-lead-in, launch-page
industries: ai saas, website builders, no-code platforms, dev tools, design tools, b2b saas, startup launches, software products
source: motionsites.ai archive (catalog title "Digitwist AI Builder — SaaS", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
Pure-black full-viewport hero for an AI website builder, built around a two-register headline pair: a quiet Instrument Serif lead-in line ("Design at the speed of thought") at 3xl-48px, followed by the shout — "Build Faster" in Instrument Sans semibold at up to 136px, `leading-[0.9]`, tracking-tighter, with a vertical gradient clip running white → white → periwinkle `#b4c0ff` so the bottom edge of the letters cools off. The serif whispers, the sans roars.

Behind it, an HLS-streamed background video (Mux `.m3u8` via hls.js with a native-Safari fallback and an Unsplash poster) plays at 60% opacity under a `bg-black/60` overlay with a 2px backdrop blur. Two huge decorative gradient blobs — blue-900/20 top-left, indigo-900/20 bottom-right, both `blur-[120px]` in screen blend — give the black depth without competing with the type. Entrances stagger: serif line fades up at 0s, the mega-headline scales from 0.9 at 0.2s, subheadline at 0.4s, buttons at 0.6s.

## Page layout
Single centered section, max-w-5xl, generous `space-y-12`. Fixed fully-transparent navbar on top: sunburst icon left, four links center (hidden on mobile), a "Book A Demo" text link and a solid white rounded-full "Get Started" button right. Below the copy, the CTA pair: a white pill ("Start Building Free") ending in a 40px solid-blue `#3054ff` circle holding a white arrow — the pill grows a soft white glow shadow and scales 1.05 on hover — and a ghost "See Examples" text button whose arrow nudges right on hover.

## Typography
- Display: Instrument Sans (400-700, italic axis) — the mega-headline at semibold, up to `lg:text-[136px]`, `leading-[0.9]`, tracking-tighter
- Lead-in: Instrument Serif (regular + italic) — the pre-headline line at up to 48px, `leading-[1.1]`
- Body: Instrument Sans at 18-20px, `leading-[1.65]`, 70% opacity

## Color palette
- Background: `#000000`; text white with `/80` and `/70` steps
- Headline gradient: white → white → `#b4c0ff` (periwinkle), `bg-clip-text`
- CTA accent: `#3054ff` blue circle, `#2040e0` on hover; button text `#0a0400`
- Decorative blobs: `blue-900/20` and `indigo-900/20` at `blur-[120px]`, `mix-blend-screen`

## Visual motifs
- **Serif whisper, sans shout** (the signature) — a small italic-capable serif line sets up a viewport-scale sans headline directly beneath it
- **Cooling gradient headline** — vertical white-to-periwinkle gradient clipped into the display type so the letterforms fade cold at the baseline
- **Streamed video under glass** — HLS background video dimmed to 60% under a black/60 overlay with a light backdrop blur, more texture than picture
- **Screen-blend gradient blobs** — two 500-600px blurred color fields parked off the corners to give flat black some atmosphere
- **Pill-with-arrow-circle CTA** — white capsule ending in a solid blue circle holding the arrow; glow shadow + scale on hover
- **Transparent navbar** — no bar, no border; the nav floats directly on the hero

## When to use
- AI products, website builders, and no-code tools announcing one core promise
- Startup launch pages where a two-word headline carries the message
- Dev and design tools that want premium-dark without neon cyberpunk
- Brands with abstract or ambient footage (not product demos) for the background
- Pages optimized for a single primary CTA

## When to NOT use
- Feature-dense products needing explanation above the fold — this layout holds about twelve words
- Light-brand or playful products; see `pressline-pr-saas-gauge-dashboard` for the light equivalent
- Anyone without streaming-ready video infrastructure or willingness to swap to a plain mp4
- Brands whose accent isn't in the blue family — the periwinkle gradient and blue CTA circle anchor the palette

## Build complexity
LOW. One section, standard Motion entrance staggers, and the hls.js snippet is drop-in; the only tuning is the gradient clip across font sizes.

## Library cross-references
- Motif: `serif-lead-in-sans-mega-headline`
- Motif: `vertical-gradient-clipped-display-type`
- Motif: `dimmed-video-under-overlay`
- Motif: `screen-blend-corner-blobs`
- Motif: `pill-with-arrow-circle-cta`
- Typography: `instrument-sans-serif-pairing`
- Color palette: `black-white-periwinkle-blue`
