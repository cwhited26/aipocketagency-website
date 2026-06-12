---
slug: glassline-liquid-glass-black-agency
name: Glassline — AI Design Agency / Black Liquid Glass
vibe: dark, glassy, cinematic, serif-accented, monochrome
industries: web design agencies, ai studios, creative agencies, branding studios, video production, digital consultancies, marketing agencies, product studios
source: motionsites.ai archive (catalog title "AI Designer Agency", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Pure black, full-viewport hero with a background video anchored object-bottom and a 240px bottom gradient melting it into the page. Content sits at the BOTTOM of the viewport (justify-end), not centered: an avatar row (three overlapping faces + "7,000+ brands already transformed"), then the headline — sans-serif up to text-7xl with tracking pulled to -2px, where one key word swaps into italic Instrument Serif ("Build ... with *AI Magic*") — then a one-line subtitle and an email-capture form styled as a liquid-glass pill: transparent input on the left, solid white rounded SUBSCRIBE button on the right, with Framer Motion scale on hover/tap.

The signature is the "liquid glass" treatment, defined as two reusable CSS classes. `.liquid-glass`: `rgba(255,255,255,0.01)` background with luminosity blend, 4px backdrop blur, an inset 1px white top highlight, and a `::before` gradient border (white fading 0.45 → 0.15 → transparent → back) applied via mask-composite exclude at 1.4px padding — a pane of glass with a light-catching rim, no visible border. `.liquid-glass-strong` is the same at blur(50px) for buttons. Everything interactive is rounded-full.

## Page layout
Seven sections, scroll-revealed with Framer Motion. Fixed glass navbar (wordmark left, five links center, glass "Get Started" pill right). After the hero: a word-by-word scroll-reveal manifesto (each word's opacity animates 0.15 → 1 as it passes through the viewport via useScroll/useTransform); a 2x2 Selected Work grid (4:3 glass-framed tiles, staggered fade-up); a full-bleed video band that OVERLAPS the section above it by 325px (`-mt-[325px]`, z-0) with gradient fades top and bottom; a full-screen CTA over a second background video ("Ready to *Transform* Your Brand?" + two pill buttons, one solid white, one glass); and a 4-column footer. Section padding runs py-32 — the page breathes.

## Typography
- Display + body: Barlow (Google Fonts, weights 400/500/600) — headings and UI, tracking -1px to -2px at display sizes
- Accent: Instrument Serif (400 italic) — one italic serif word inside each major heading, the brand's recurring flourish
- Manifesto text at text-3xl to 5xl, font-medium, relaxed leading

## Color palette
- Background: pure black `#000000` everywhere
- Text: pure white, with muted copy at 75% white
- Glass surfaces: `rgba(255,255,255,0.01)` + blur + gradient rims — the "color" is light, not pigment
- Borders: 20% white; cards 9% white
- No hue anywhere — a strict monochrome system; the videos provide all the color

## Visual motifs
- **Liquid-glass surfaces** — panes built from near-zero white fill, backdrop blur, an inset top highlight, and a masked gradient rim that brightens at top and bottom edges; used on nav, buttons, form, and work tiles
- **Italic serif accent word** — every major heading is sans except one word in italic Instrument Serif, repeated section after section as the brand tic
- **Word-by-word scroll reveal** — the manifesto paragraph fades each word from 15% to full opacity as the visitor scrolls through it
- **Bottom-anchored hero content** — headline and form sit at the foot of the viewport over the video's gradient fade, not centered
- **Email pill form** — glass capsule wrapping a transparent input and a solid white submit button
- **Overlapping video band** — a full-bleed showcase video pulled 325px up under the previous section, with gradient fades stitching the seam
- **Avatar-row social proof** — three overlapping rounded faces plus a brands-transformed count, placed before the headline
- **All-pill geometry** — every button and form on the page is rounded-full

## When to use
- Design, web, and AI agencies selling premium production values
- Studios with strong reels — three video slots reward good footage
- Brands that want dark and cinematic without any color commitment
- Portfolio-led businesses where a 4-tile work grid is enough proof
- Newsletter or lead-capture funnels that suit an email-first hero CTA

## When to NOT use
- Anyone without 2-3 strong videos; the design leans on footage at hero, mid-page, and CTA
- Colorful, playful brands — this is strict monochrome; use `glassmorphism-purple-pink-agency` for glass with color
- Content-heavy sites — the manifesto and grid carry maybe 80 words total
- Local service businesses that need phone-first conversion — use `trades-phone-first-emergency`

## Build complexity
MEDIUM complexity. The liquid-glass CSS is fiddly (mask-composite gradient rims) but reusable once written; the scroll-reveal text and section overlap are standard Framer Motion. Streaming video in the CTA section adds a player dependency.

## Library cross-references
- Motif: `liquid-glass-gradient-rim`
- Motif: `italic-serif-accent-word`
- Motif: `word-by-word-scroll-reveal`
- Motif: `bottom-anchored-hero-content`
- Motif: `overlapping-video-band`
- Motif: `email-capture-glass-pill`
- Typography: `barlow-instrument-serif-accent`
- Color palette: `pure-black-white-glass-monochrome`
