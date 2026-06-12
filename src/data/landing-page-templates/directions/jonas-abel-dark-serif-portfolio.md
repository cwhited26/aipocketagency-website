---
slug: jonas-abel-dark-serif-portfolio
name: Jonas Abel — Dark Serif Portfolio with Counter Preloader
vibe: dark, editorial, serif-italic, polished, personal
industries: designers, developers, photographers, creative directors, freelancers, motion designers, art directors, small studios
source: motionsites.ai archive (catalog title "Portfolio Cosmic — Portfolio", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
The site opens with a full-screen preloader: a counter runs 000 to 100 over 2700ms (rAF-driven, tabular numerals at text-9xl bottom-right) while rotating words — "Design", "Create", "Inspire" — cycle every 900ms in italic serif at center, over a 3px progress bar with a steel-blue gradient fill and a soft glow. Then the hero: a background video (HLS-streamed) under a 20% black wash, with the owner's name dead center at text-9xl in Instrument Serif italic, entering via a GSAP power3 rise (opacity 0, y 50, 1.2s). Below it a role line — "A {Creative / Fullstack / Founder / Scholar} lives in Chicago." — where the role word swaps every 2s with a small fade-up. Eyebrow and description blur in from 10px.

The nav is a floating glass pill, top-center: a circular monogram logo ringed by the accent gradient (the ring reverses direction on hover), hairline dividers, pill links, and a "Say hi" button that grows an animated gradient border on hover. It picks up a shadow once the page scrolls past 100px.

## Page layout
Seven sections: preloader, hero, a bento works grid (12-col, cards spanning 7/5 then 5/7, each with a halftone dot overlay and a hover state that blurs the image under a "View — Title" gradient-border pill), a journal of horizontal pill-shaped entries, a 300vh pinned parallax gallery (center copy pinned with ScrollTrigger while two card columns scroll past at different speeds, lightbox on click), a 3-stat row, and a footer with an infinite GSAP marquee ("BUILDING THE FUTURE • ") over the hero video flipped upside-down at 60% black. Content sits in a 1200px max column. Forced dark theme, no toggle.

## Typography
- Display: Instrument Serif (Google Fonts, italic 400) — the name at text-9xl, every italicized keyword ("projects", "thoughts", "playground"), the rotating preloader words, the monogram
- Body: Inter (Google Fonts, 300-700) — UI, nav, descriptions, stats
- Eyebrows: 12px uppercase, `tracking 0.3em`, muted gray, paired with a 32px hairline dash
- Counter and stats in tabular numerals

## Color palette
- Background: `#0a0a0a` (hsl 0 0% 4%)
- Surface: `#141414` (hsl 0 0% 8%), hairline strokes at 12% lightness
- Text: near-white `#f5f5f5`; muted `#878787`
- Accent gradient: `#89AACC` to `#4E85BF` (steel blue, 90deg) — logo ring, hover borders, progress bar, with a `rgba(137,170,204,0.35)` glow
- Hover overlays: `bg-black/70` with backdrop blur

## Visual motifs
- **Counter preloader** — 000-to-100 numeric count with rotating italic words and a glowing gradient progress bar; 400ms hold, then the site reveals
- **Floating glass pill nav** — a single backdrop-blurred capsule top-center holding monogram, links, and CTA, separated by hairline dividers
- **Animated gradient border on hover** — buttons and pills grow a steel-blue gradient ring (a -2px inset span) whose background-position shifts on a 6s loop
- **Cycling role word** — one word in the intro sentence swaps every 2 seconds with a fade-up, in italic serif
- **Bento works grid with halftone hover** — alternating 7/5 column spans; a 4px radial-dot halftone texture sits over every image, and hover blurs the card under a "View" pill
- **Pinned parallax gallery** — a 300vh section where the heading stays pinned while two columns of tilted square cards scroll past at different rates
- **Flipped-video footer** — the hero video reused upside-down under heavier black, beneath an endless scrolling marquee headline
- **Availability pulse** — a green dot pulsing next to "Available for projects" in the footer bar

## When to use
- Individual designers, developers, and creative directors who need one polished personal site
- Photographers and motion designers with strong visual work to fill the bento grid
- Freelancers whose pitch is taste — the serif italics and loader do the talking
- Small studios presenting as a named individual or duo
- Anyone with 4-6 strong projects and a few writing samples

## When to NOT use
- Companies and product brands — this reads as one person's site, by design
- Anyone with thin work samples; the bento grid and gallery demand 10+ strong images
- Conversion pages — the preloader costs ~3 seconds before any content appears
- Mobile-first audiences in a hurry; the pinned gallery and loader reward unhurried desktop browsing (use `jack-3d-creator-portfolio` for a punchier single-screen portfolio)

## Build complexity
HIGH — preloader timing, HLS video wiring, GSAP ScrollTrigger pinning, parallax columns, and a lightbox stack on top of an otherwise standard page; the individual pieces are known patterns but there are many of them.

## Library cross-references
- Motif: `counter-preloader-rotating-words`
- Motif: `floating-glass-pill-nav`
- Motif: `animated-gradient-hover-border`
- Motif: `cycling-inline-role-word`
- Motif: `bento-grid-halftone-hover`
- Motif: `pinned-parallax-column-gallery`
- Motif: `flipped-video-footer-marquee`
- Typography: `instrument-serif-italic-inter`
- Color palette: `charcoal-steel-blue-gradient`
