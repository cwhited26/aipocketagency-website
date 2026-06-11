---
slug: prisma-cinematic-cream-collective
name: Prisma — Cinematic Cream Collective
vibe: cinematic, moody, editorial, warm-cream, sophisticated
industries: creative studio, filmmakers, photographers, visual arts, hospitality (boutique), high-end brand identity
source: motionsites.ai (Prisma prompt)
last_used: never
last_client: never
---

## Hero treatment
Full viewport with `p-4 md:p-6` outer padding creating an inset effect (the page itself frames the hero). Inside is a rounded-2xl container with overflow-hidden. Background video fills the inset frame with a noise overlay (`mix-blend-overlay`, 0.7 opacity) and a subtle gradient. The brand name "Prisma" sits as a giant display word at the BOTTOM of the hero in a 12-column grid (left 8 cols), with a 4-column description paragraph + CTA on the right. The display word features a superscript asterisk (*) on its final letter.

The navbar is a black pill that HANGS DOWN from the top edge (rounded-b-2xl) with the centered links.

## Page layout
Three sections total: Hero (inset framed) → About (centered black card with italic display + scroll-revealed body text) → Features (4-column card grid with mixed video + image content). The About section uses a scroll-linked character-by-character opacity reveal on the body paragraph — characters fade in from 0.2 → 1 opacity as the reader scrolls past.

## Typography
- Primary face: Almarai (Google Fonts) — weights 300/400/700/800. Used globally including the giant "Prisma" word.
- Italic accent: Instrument Serif (italic only) — used for a single italic phrase inside an otherwise sans heading ("I am Marcus Chen, *a self-taught director.* I have skills in...")
- Display sizing: clamp-style responsive — the brand word uses `text-[26vw] sm:text-[24vw] md:text-[22vw] lg:text-[20vw]` with `tracking-[-0.07em]` and `leading-[0.85]`
- Color: globally `text-primary` = `#E1E0CC` (warm cream)

## Color palette
- Background: `#000000` global, `#101010` for the About card, `#212121` for Features cards
- Primary text: `#E1E0CC` (warm cream — applied via inline style; differs subtly from the Tailwind primary)
- Tailwind primary: `#DEDBC8` (warm cream — used in utility classes like `text-primary/70`)
- Gray: `text-gray-400`, `text-gray-500` (secondary copy)
- Nav link: `rgba(225,224,204,0.8)` with hover `#E1E0CC`

## Visual motifs
- Inset hero container with rounded corners (`rounded-2xl md:rounded-[2rem]`) — the page itself frames the hero
- SVG noise texture overlay on hero video (`feTurbulence baseFrequency=0.85 numOctaves=3`, 0.7 opacity, `mix-blend-overlay`)
- Hanging black pill navbar (rounded-b only, sits flush with top edge)
- Giant display word as the focal point, bottom-anchored in the hero
- Superscript asterisk on final character of the display word
- Words-pull-up text animation: each word slides up from `y:20` with 0.08s staggered delay, triggered by `useInView`
- Mixed style heading where one phrase inside a longer heading switches to italic serif
- Scroll-linked character-by-character opacity reveal on body text (uses `useScroll` + `useTransform`, each character's opacity tied to scroll progress)
- 4-column feature card grid that combines a video card (full bleed) + 3 dark icon+checklist cards
- Each feature card has a numbered indicator (01, 02, 03) and a "Learn more →" link with a rotated arrow (-45deg)

## When to use
- Creative studios and production houses
- Filmmakers, directors, cinematographers
- Photographers (high-end portrait, fashion, editorial)
- Visual artists and visual development collectives
- Boutique hotels and hospitality brands wanting an editorial / "designed by an art director" feel
- High-end brand identity agencies
- Anyone whose audience reads design magazines

## When to NOT use
- Local trades — too slow to load, too editorial, not enough trust signal
- Health / legal / financial — wrong emotional register entirely
- E-commerce (the focal display word competes with product photography)
- Anything where the visitor needs to convert quickly
- Anything that needs to look "approachable / family-friendly" instead of "curated"

## Reference source
motionsites.ai Prisma prompt — extracted 2026-06-11.

## Library cross-references
- Motif: `scroll-linked-character-opacity-reveal` (the standout body-text effect)
- Motif: `noise-overlay-svg-fractal` (the cinematic film grain)
- Motif: `inset-rounded-hero-frame` (the page-frames-the-hero pattern)
- Typography: `almarai-instrument-serif-italic` (the specific pairing)
- Color palette: `warm-cream-on-deep-black` (the color system)
