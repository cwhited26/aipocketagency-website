---
slug: vanguard-fierce-creative-collective
name: Vanguard — Fierce Creative Collective
vibe: bold, fierce, world-class, premium agency, immersive video
industries: creative agency, design studio, brand collective, marketing agency, video production
source: motionsites.ai (VANGUARD prompt)
last_used: never
last_client: never
---

## Hero treatment
Single viewport-height section with fullscreen looping background video. All content overlaid. Hero text is LEFT-aligned, vertically centered. Three-line display heading dominates the page ("Design. Disrupt. Conquer." style). Stats row at the bottom shows quantitative trust ("250+ Brands Transformed / 95% Client Retention / 10+ Years in the Game"). Award badge sits next to the primary CTA. Tagline above the heading uses a small icon + spaced-out caps label.

## Page layout
Single viewport hero (h-screen). Mobile-first padding scaling from `px-6` to `px-16` at large screens. Content is bottom-anchored on mobile, vertically centered on desktop. Stats row uses `flex-wrap` to prevent overflow.

## Typography
- Display: FSP DEMO PODIUM Sharp 4.11 — clamp(2.8rem, 8vw, 7rem), uppercase, `leading-[0.92]`, tight tracking. The brand wordmark uses the same display face at `text-2xl sm:text-3xl`.
- Body: Inter — weights 400/500/600/700. Nav and CTAs use `text-xs` with `tracking-widest` uppercase. Subtext uses `text-sm sm:text-base`, `leading-relaxed`.
- Accent: Small caps tagline above the heading uses `tracking-[0.3em]` to feel editorial.

## Color palette
- Primary: `#000000` (pure black for the CTA button)
- Secondary: video footage tone provides the warm/dark hue
- Accent: white (`#FFFFFF`) for all text
- Text on overlay: `text-white/70` for de-emphasized body, `text-white/50` for stats labels
- Translucent borders: `border-white/30` on the bordered "GET IN TOUCH" CTA

## Visual motifs
- Looping video background, autoplay-muted-loop-playsInline, `object-cover` fill
- Staggered fade-up animations on every hero element (0s, 0.2s, 0.4s, 0.6s, 0.8s delays)
- Bordered "GET IN TOUCH" pill button alongside a solid black "SEE OUR WORK" pill
- Award icon + two-line micro-label adjacent to the primary CTA
- Stats row with `flex-wrap`: large bold number + tight tracking, small uppercase label below
- Mobile full-screen menu overlay with staggered link entrance animations

## When to use
- Creative agencies and design studios with great existing video footage
- Brand collectives wanting to feel collaborative + premium
- Production houses, video studios, motion design shops
- Marketing agencies pitching enterprise / mid-market work
- Boutique studios where the founder wants the audience to feel impressed before reading a single word
- Any business where the visitor's first emotional response should be "this looks expensive"

## When to NOT use
- Local trades (HVAC, plumbing, roofing, electrical) — visitors need phone number + price hint above the fold, not cinematic video
- Restoration / emergency services — visitor is in a hurry, not browsing
- Medical / legal / financial — credibility comes from clean structure + credentials, not video drama
- Anything that needs to load fast on a poor connection (video bg kills LCP)
- Anything where the client doesn't have great existing video assets (placeholder stock video looks vibe-coded)

## Reference source
motionsites.ai VANGUARD prompt — extracted 2026-06-11.

## Library cross-references
- Motif: `cursor-spotlight-reveal-canvas-mask` (alternative hero treatment for this vibe)
- Typography: `podium-display-inter-body` (the specific pairing)
- Color palette: `monochrome-on-video-overlay` (the color system)
