---
slug: sojourne-curtain-portal-fantasy-voyage
name: Sojourne — Curtain-Reveal Portal / Fantasy Voyage
vibe: cinematic, fantastical, scroll-driven, theatrical, immersive
industries: luxury travel, experiential travel, immersive entertainment, game studios, theme parks and attractions, event production, vr experiences, boutique tour operators
source: motionsites.ai archive (catalog title "Aetheris Voyage", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A theater-curtain opening onto another world. The page is one 480vh scroll container with a sticky 100vh viewport; everything happens in layers inside it. On load, two painted curtain images part 62% left/right over 1.8s (`cubic-bezier(0.16, 1, 0.3, 1)`), revealing an ornate portal frame with a fantasy landscape behind it. Scrolling drives the camera THROUGH the portal: the frame scales from 1 to 7.5 (origin `52% 38%`) and fades out past 65% scroll, the world behind scales 1 → 1.18, the curtains slide a further 150% off-stage, and a cloud layer at the bottom swells (scale 1 → 1.4). Every layer also tracks the mouse with its own parallax magnitude (world 6, portal 7, clouds 9, curtains 14), smoothed by a lerp loop at 0.07 per frame — the scene feels dimensional before you ever scroll.

Scene 1 UI floats over the opening: a serif heading in the pattern "FALL › INTO SOJOURNE" (the › in a warm ember tone, "INTO" italic), a short myth-flavored subtitle, three rounded 158px cards on the right (two "View Reel" play cards, one patron-count card with glass-blurred bottom labels), slider dots, and a bobbing "DESCEND" scroll cue. It all fades out in the first 22% of scroll. Scene 2 fades in past 68%: a giant serif statement ("FORGE BEYOND THE REAL") plus a one-line promise, and an ARC CARD SLIDER along the bottom — nine pastel destination cards positioned on a huge invisible wheel (radius 700–1100px) that rotates with scroll, each card tilted along the arc with a numbered circle, serif title, and one-line description.

## Page layout
Two scenes, one continuous camera move — the page reads as a single shot, not sections. Scene 1 has three distinct authored layouts (mobile: one card, dark-brown text; tablet: three cards, dark-brown text; desktop: split layout, white text with heavy text-shadow). Split nav: three links left, star logo center, three links right; mobile collapses to two links flanking the logo.

## Typography
- Display: Viaoda Libre (Google Fonts) — headings, card titles, the patron number
- Body: Imprima (Google Fonts) — nav links (uppercase, 12px, 0.12em tracking), subtitles, card descriptions
- Scene 1 heading runs to clamp 88px desktop; Scene 2 statement clamps 38–78px

## Color palette
- Base / letterbox: near-black warm `#0a0608`
- Scene 1 mobile/tablet text: dark brown `#3b1a0a` with ember accent `#6b2e0e`
- Desktop hero text: white with `text-shadow: 0 2px 24px rgba(0,0,0,0.7)`
- Arc cards: pastel rotation `#f3cdd6`, `#dcedc2`, `#c3e3f4`, `#f0e4c0`, `#dcd2f2` with ink `#3a2530`
- Top and bottom fade gradients: `rgba(0,0,0,0.45)` to transparent

## Visual motifs
- **Opening curtains** (the signature) — two painted curtain halves part on load, then slide fully away as you scroll
- **Zoom-through portal** — an ornate frame scales 7.5x with scroll so the visitor flies through it into the world behind
- **Layered mouse parallax** — five layers each drift opposite the cursor at their own magnitude, smoothed per-frame
- **Arc card slider** — nine pastel cards on a giant invisible wheel rotate past as scroll progresses
- **Scene crossfade storytelling** — UI for scene 1 fades out by 22% scroll, scene 2 fades in after 68%; the world is the constant
- **Bobbing scroll cue** — circled chevron with "DESCEND" label, 1.8s bounce loop
- **Glass-blurred card labels** — play buttons and patron counts sit on gradient + backdrop-blur strips at card bottoms

## When to use
- Experiential and luxury travel brands selling destinations that feel unreal
- Immersive entertainment — VR studios, escape experiences, theme attractions
- Game studios and fantasy IP announcing a world, not a feature list
- Event production houses pitching transportive one-night experiences
- Any brand whose pitch is "step into another world" and has painterly art to prove it

## When to NOT use
- Brands without bespoke painted/3D artwork — the curtains and portal demand custom art, not stock photos
- Conversion-first landing pages; this is a browsing experience with one soft CTA
- Mobile-dominant audiences — the choreography survives on mobile but the magic is desktop
- Corporate B2B services; the theatrical tone undermines a sober pitch (use `cognitra-ai-agency-gray-panel`)

## Build complexity
HIGH complexity. Five transform layers driven by both scroll progress and smoothed mouse position, three authored responsive layouts, and the arc slider's wheel math. Comparable effort to `velar-luxury-real-estate`.

## Library cross-references
- Motif: `opening-curtains-load-reveal`
- Motif: `zoom-through-portal-scroll`
- Motif: `layered-mouse-parallax-lerp`
- Motif: `arc-card-slider-scroll-wheel`
- Motif: `scene-crossfade-sticky-viewport`
- Motif: `bobbing-scroll-cue`
- Typography: `viaoda-imprima-storybook`
- Color palette: `warm-black-brown-pastel-cards`
